// --- Main Page Protection ---
// This is the final correct code for js/main.js

function authFetch(url, options = {}) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        logout();
        return Promise.reject(new Error('No token found.'));
    }
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers }).then(response => {
        if (response.status === 401) {
            console.error('Authentication error. Logging out.');
            logout();
            return Promise.reject(new Error('Unauthorized'));
        }
        return response;
    });
}

function logout() {
    // This check makes the narrator work if it exists on the page.
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader('جاري تسجيل الخروج...');
    }
    
    // Clear the session storage.
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');

    // Simplified: Always redirect to the login page.
    window.location.href = 'login.html';
}


let inactivityTimer;

// --- STATE MANAGEMENT ---
let currentState = {
    specialty: null,
    course: null,
    need: null,
    modalZoom: 1,
    currentContent: null,
    loadedContent: {
        videos: [],
        lectures: [],
        documents: []
    }
};

// --- INITIALIZATION ---
window.onload = function() {
    const sidebar = document.getElementById('controlPanel');
    if (sidebar) {
        sidebar.classList.add('panel-collapsed');
    }
    
    // Initialize text size from localStorage
    if (localStorage.getItem('textSize')) {
        const size = localStorage.getItem('textSize');
        adjustSize(size, true);
        document.getElementById('sizeSlider').value = size;
        updateSizeLabel(size);
    }
    
    // Initialize content size from localStorage
    if (localStorage.getItem('contentSize')) {
        const contentSize = localStorage.getItem('contentSize');
        adjustContentSize(contentSize, true);
        document.getElementById('contentSizeSlider').value = contentSize;
        updateContentSizeLabel(contentSize);
    }
    
    // Initialize theme from localStorage
    if (localStorage.getItem('theme')) {
        changeTheme(localStorage.getItem('theme'), true);
    }
    
    loadSpecialties();
    announceToScreenReader('تم تحميل بوابة التعليم الشامل لجامعة القدس المفتوحة. جاري تحميل التخصصات الأكاديمية...');

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(function(event) {
        window.addEventListener(event, resetInactivityTimer, false);
    });

    resetInactivityTimer();
};

// --- DATA FETCHING FUNCTIONS (API) ---
async function loadSpecialties() {
  const specialtiesGrid = document.getElementById('specialtiesGrid');
  const specialtiesLoader = document.getElementById('specialtiesLoader');
  try {
    const response = await authFetch('/api/specialties');
    if (!response.ok) throw new Error('Network response was not ok');
    const specialties = await response.json();
    displaySpecialties(specialties);
  } catch (err) {
    console.error('Failed to load specialties:', err);
    if(specialtiesLoader) specialtiesLoader.style.display = 'none';
    if(specialtiesGrid) specialtiesGrid.innerHTML = '<div class="error-message">حدث خطأ في تحميل التخصصات.</div>';
  }
}

async function loadCourses(specialtyId) {
    const coursesLoader = document.getElementById('coursesLoader');
    const coursesGrid = document.getElementById('coursesGrid');

    if(coursesLoader) coursesLoader.style.display = 'block';
    if(coursesGrid) coursesGrid.innerHTML = '';

    if (!specialtyId) {
        console.error("loadCourses was called with an invalid ID.");
        if (coursesLoader) coursesLoader.style.display = 'none';
        if(coursesGrid) coursesGrid.innerHTML = '<div class="error-message">لم يتم تحديد التخصص بشكل صحيح.</div>';
        return;
    }

    try {
        const response = await authFetch(`/api/courses?specialtyId=${specialtyId}`);
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        const courses = await response.json();
        displayCourses(courses);
    } catch (err) {
        console.error('Failed to fetch and display courses:', err);
        if (coursesLoader) coursesLoader.style.display = 'none';
        if(coursesGrid) coursesGrid.innerHTML = '<div class="error-message">حدث خطأ أثناء تحميل المواد. يرجى المحاولة مرة أخرى.</div>';
    }
}

async function loadContent(courseId, accessibilityNeed) {
    const videosList = document.getElementById('videosList');
    const lecturesList = document.getElementById('lecturesList');
    const documentsList = document.getElementById('documentsList');

    try {
        if (videosList) videosList.innerHTML = '<div class="loader" id="videosLoader"></div>';
        if (lecturesList) lecturesList.innerHTML = '<div class="loader" id="lecturesLoader"></div>';
        if (documentsList) documentsList.innerHTML = '<div class="loader" id="documentsLoader"></div>';

        const [videosRes, lecturesRes, documentsRes] = await Promise.all([
            authFetch(`/api/videos?courseId=${courseId}&accessibilityNeed=${accessibilityNeed}`),
            authFetch(`/api/lectures?courseId=${courseId}&accessibilityNeed=${accessibilityNeed}`),
            authFetch(`/api/documents?courseId=${courseId}&accessibilityNeed=${accessibilityNeed}`)
        ]);
        
        if (!videosRes.ok || !lecturesRes.ok || !documentsRes.ok) throw new Error('One or more content API requests failed');

        const videos = await videosRes.json();
        const lectures = await lecturesRes.json();
        const documents = await documentsRes.json();

        currentState.loadedContent = { videos, lectures, documents };
        
        displayVideos(videos);
        displayLectures(lectures);
        displayDocuments(documents);

    } catch (err) {
        console.error('Failed to load content:', err);
        displayVideos([]);
        displayLectures([]);
        displayDocuments([]);
    }
}

// --- DISPLAY FUNCTIONS ---
function displaySpecialties(specialties) {
    const specialtiesGrid = document.getElementById('specialtiesGrid');
    const specialtiesLoader = document.getElementById('specialtiesLoader');
    if(specialtiesLoader) specialtiesLoader.style.display = 'none';
    specialtiesGrid.innerHTML = '';
    
    if (!specialties || specialties.length === 0) {
        specialtiesGrid.innerHTML = '<div class="error-message">لا توجد تخصصات متاحة حاليًا</div>';
        return;
    }
    
    specialties.forEach(specialty => {
        const btn = document.createElement('button');
        btn.className = 'specialty-btn';
        btn.innerHTML = `<i class="${specialty.icon || 'fas fa-book'}"></i> ${specialty.name}`;
        btn.onclick = () => showCoursesPage(specialty);
        btn.setAttribute('aria-label', `تخصص ${specialty.name}`);
        specialtiesGrid.appendChild(btn);
    });
    
    announceToScreenReader('تم تحميل التخصصات الأكاديمية. اختر التخصص المناسب للبدء.');
}

function displayCourses(courses) {
    const coursesGrid = document.getElementById('coursesGrid');
    const coursesLoader = document.getElementById('coursesLoader');

    if (coursesLoader) coursesLoader.style.display = 'none';
    coursesGrid.innerHTML = ''; 
    
    if (!courses || courses.length === 0) {
        coursesGrid.innerHTML = '<div class="error-message">لا توجد مواد متاحة لهذا التخصص حاليًا</div>';
        return;
    }
    
    courses.forEach(course => {
        const btn = document.createElement('button');
        btn.className = 'course-btn';
        btn.innerHTML = `<i class="${course.icon || 'fas fa-book-open'}"></i> ${course.name}`;
        btn.onclick = () => showNeedsPage(course);
        btn.setAttribute('aria-label', `مادة ${course.name}`);
        coursesGrid.appendChild(btn);
    });
    
    announceToScreenReader('تم تحميل المواد الدراسية. اختر المادة لعرض المحتوى التعليمي.');
}

function displayVideos(videos) {
    const videosList = document.getElementById('videosList');
    videosList.innerHTML = '';
    if (!videos || videos.length === 0) {
        videosList.innerHTML = '<li class="error-message">لا تتوفر فيديوهات لهذه المادة</li>';
        return;
    }
    videos.forEach(video => {
        const li = document.createElement('li');
        li.className = 'content-item';
        li.innerHTML = `<a href="#" class="content-link" onclick="showVideoModal(event, '${video._id}')"><i class="fas fa-play-circle"></i> ${video.title}</a>`;
        videosList.appendChild(li);
    });
}

function displayLectures(lectures) {
    const lecturesList = document.getElementById('lecturesList');
    lecturesList.innerHTML = '';
    if (!lectures || lectures.length === 0) {
        lecturesList.innerHTML = '<li class="error-message">لا تتوفر محاضرات صوتية لهذه المادة</li>';
        return;
    }
    lectures.forEach(lecture => {
        const li = document.createElement('li');
        li.className = 'content-item';
        li.innerHTML = `<a href="#" class="content-link" onclick="showAudioModal(event, '${lecture._id}')"><i class="fas fa-headphones"></i> ${lecture.title}</a>`;
        lecturesList.appendChild(li);
    });
}

function displayDocuments(documents) {
    const documentsList = document.getElementById('documentsList');
    documentsList.innerHTML = '';
    if (!documents || documents.length === 0) {
        documentsList.innerHTML = '<li class="error-message">لا تتوفر وثائق لهذه المادة</li>';
        return;
    }
    documents.forEach(doc => {
        const li = document.createElement('li');
        li.className = 'content-item';
        li.innerHTML = `<a href="#" class="content-link" onclick="showDocumentModal(event, '${doc._id}')"><i class="fas fa-file-download"></i> ${doc.title}</a>`;
        documentsList.appendChild(li);
    });
}

// --- PAGE NAVIGATION ---
function showPage(pageIdToShow) {
    const pages = ['specialtiesPage', 'coursesPage', 'needsPage', 'contentPage'];
    pages.forEach(pageId => {
        const page = document.getElementById(pageId);
        if(page) page.style.display = (pageId === pageIdToShow) ? 'block' : 'none';
    });
}

function showCoursesPage(specialty) {
    currentState.specialty = specialty;
    document.getElementById('courseIcon').innerHTML = `<i class="${specialty.icon || 'fas fa-book'}"></i>`;
    document.getElementById('courseTitle').textContent = specialty.name;
    document.getElementById('courseDescription').textContent = specialty.description;
    showPage('coursesPage');
    const specialtyId = specialty._id || specialty.id;
    loadCourses(specialtyId);
    announceToScreenReader(`تخصص ${specialty.name}. جاري تحميل المواد الدراسية...`);
}

function showNeedsPage(course) {
    currentState.course = course;
    document.getElementById('materialTitle').textContent = course.name;
    showPage('needsPage');
    announceToScreenReader(`مادة ${course.name}. اختر طريقة العرض المناسبة.`);
}

function showContentPage(need) {
    currentState.need = need;
    document.getElementById('contentTitle').textContent = `${currentState.course.name} - ${getContentTitle(need)}`;
    document.getElementById('contentDescription').textContent = getContentDescription(need);
    showPage('contentPage');
    loadContent(currentState.course._id, need);
    announceToScreenReader(`محتوى تعليمي لـ ${currentState.course.name}. جاري تحميل...`);
}

function goBack(pageId) {
    showPage(pageId);
    const pageTitle = document.querySelector(`#${pageId} .page-title, #${pageId} .course-title`)?.textContent;
    if (pageTitle) announceToScreenReader(`العودة إلى ${pageTitle}`);
}

// --- MODAL FUNCTIONS ---
function showVideoModal(event, videoId) {
    event.preventDefault();
    const video = currentState.loadedContent.videos.find(v => v._id === videoId);
    if (!video) return alert('الفيديو غير متوفر حالياً');
    const embedUrl = getYouTubeEmbedUrl(video.url);
    
    openModal(video.title, `
        <p>${video.description || ''}</p>
        <div class="video-container">
            <iframe src="${embedUrl}" title="${video.title}" frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
        </div>
    `);
    
    // Apply color filter after iframe is loaded
    setTimeout(() => {
        applyColorFilterToContent();
    }, 500);
}

function showAudioModal(event, audioId) {
    event.preventDefault();
    const audio = currentState.loadedContent.lectures.find(a => a._id === audioId);
    if (!audio) return alert('المحاضرة الصوتية غير متوفرة حالياً');
    openModal(audio.title, `
        <p>${audio.description || ''}</p>
        <audio controls autoplay class="audio-player" style="width: 100%;">
            <source src="${audio.fileUrl}" type="audio/mpeg">
            متصفحك لا يدعم عنصر الصوت.
        </audio>
    `);
}

function showDocumentModal(event, docId) {
    event.preventDefault();
    const doc = currentState.loadedContent.documents.find(d => d._id === docId);
    if (!doc) return alert('الوثيقة غير متوفرة حالياً');
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(doc.fileUrl)}&embedded=true`;
    
    openModal(doc.title, `
        <p>${doc.description || 'لا يوجد وصف متاح.'}</p>
        <div class="document-viewer">
            <iframe src="${googleViewerUrl}" width="100%" height="100%" style="border: none;" title="${doc.title}"></iframe>
        </div>
        <div style="margin-top: 20px; display: flex; justify-content: center; gap: 15px;">
            <a href="${doc.fileUrl}" class="submit-btn" download><i class="fas fa-download"></i> تحميل الملف الأصلي</a>
        </div>
    `);
    
    // Apply color filter after iframe is loaded
    setTimeout(() => {
        applyColorFilterToContent();
    }, 500);
}

function openModal(title, bodyHtml) {
    currentState.currentContent = { title };
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('contentModal').classList.add('active');
    document.getElementById('contentControls').style.display = 'flex';
    announceToScreenReader(`تم فتح نافذة لعرض ${title}`);
}

function closeModal() {
    const modalBody = document.getElementById('modalBody');
    document.getElementById('contentModal').classList.remove('active');
    
    if (modalBody) {
        modalBody.innerHTML = '';
        modalBody.style.transform = 'scale(1)';
    }
    currentState.modalZoom = 1;

    if (currentState.currentContent) {
        announceToScreenReader(`تم إغلاق ${currentState.currentContent.title}`);
        currentState.currentContent = null;
    }
}

// --- COLOR FILTER FUNCTIONS ---
function applyColorFilterToContent() {
    const currentTheme = document.body.dataset.theme || 'default';
    const iframes = document.querySelectorAll('.video-container iframe, .document-viewer iframe');
    
    iframes.forEach(iframe => {
        // Reset all filters first
        iframe.style.filter = 'none';
        
        // Apply appropriate filter based on current theme
        switch(currentTheme) {
            case 'protanopia':
                iframe.style.filter = 'url("#protanopiaFilter")';
                break;
            case 'deuteranopia':
                iframe.style.filter = 'url("#deuteranopiaFilter")';
                break;
            case 'tritanopia':
                iframe.style.filter = 'url("#tritanopiaFilter")';
                break;
            case 'achromatopsia':
                iframe.style.filter = 'grayscale(100%)';
                break;
            case 'high-contrast':
                iframe.style.filter = 'contrast(200%) brightness(150%)';
                break;
            default:
                iframe.style.filter = 'none';
        }
    });
}

// --- TEXT SIZE ADJUSTMENT FUNCTIONS ---
function adjustSize(value, silent = false) {
    const size = parseFloat(value);
    document.documentElement.style.setProperty('--text-size', `${size * 16}px`);
    document.documentElement.style.setProperty('--icon-scale', size);
    localStorage.setItem('textSize', value);
    updateSizeLabel(value);
    
    if (!silent) {
        announceToScreenReader(`حجم النص ${document.getElementById('sizeLabel').textContent}`);
    }
}

function updateSizeLabel(value) {
    const sizeLabels = {
        '0.8': 'صغير جدًا',
        '1': 'عادي',
        '1.2': 'كبير',
        '1.4': 'كبير جدًا',
        '1.6': 'ضخم',
        '1.8': 'ضخم جدًا',
        '2': 'عملاق',
        '3': 'كبير جدًا جدًا'
    };
    
    const sizeLabel = document.getElementById('sizeLabel');
    sizeLabel.textContent = sizeLabels[value] || sizeLabels['1'];
}

// --- CONTENT SIZE ADJUSTMENT FUNCTIONS ---
function adjustContentSize(value, silent = false) {
    const size = parseFloat(value);
    document.documentElement.style.setProperty('--content-scale', size);
    localStorage.setItem('contentSize', value);
    updateContentSizeLabel(value);
    
    if (!silent) {
        announceToScreenReader(`حجم المحتوى ${document.getElementById('contentSizeLabel').textContent}`);
    }
}

function updateContentSizeLabel(value) {
    const sizeLabels = {
        '0.5': 'صغير جدًا',
        '0.6': 'صغير',
        '0.7': 'صغير نسبيًا',
        '0.8': 'أصغر من العادي',
        '0.9': 'أصغر قليلاً',
        '1': 'عادي',
        '1.1': 'أكبر قليلاً',
        '1.2': 'كبير',
        '1.3': 'كبير نسبيًا',
        '1.4': 'كبير جدًا',
        '1.5': 'ضخم'
    };
    
    const sizeLabel = document.getElementById('contentSizeLabel');
    sizeLabel.textContent = sizeLabels[value] || sizeLabels['1'];
}

// --- THEME MANAGEMENT ---
function changeTheme(theme, silent = false) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    
    // Apply color filters to all content
    applyColorFilterToContent();
    
    if (!silent) {
        const themeNames = {
            'default': 'الوضع الافتراضي',
            'protanopia': 'وضع عمى الأحمر',
            'deuteranopia': 'وضع عمى الأخضر',
            'tritanopia': 'وضع عمى الأزرق',
            'achromatopsia': 'وضع عمى الألوان الكلي',
            'high-contrast': 'وضع التباين العالي'
        };
        announceToScreenReader(`تم تغيير الثيم إلى ${themeNames[theme] || theme}`);
    }
}

// --- UTILITY FUNCTIONS ---
function zoomContent(direction) {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    const step = 0.1;
    const minZoom = 0.5;
    const maxZoom = 2.0;

    if (direction === 'in') {
        currentState.modalZoom = Math.min(maxZoom, currentState.modalZoom + step);
    } else if (direction === 'out') {
        currentState.modalZoom = Math.max(minZoom, currentState.modalZoom - step);
    } else if (direction === 'reset') {
        currentState.modalZoom = 1;
    }

    modalBody.style.transform = `scale(${currentState.modalZoom})`;
    modalBody.style.transformOrigin = 'top';
}

function getYouTubeEmbedUrl(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
}

function getContentTitle(need) {
    const titles = {
        'colorBlindness': "عمى الألوان", 'deaf': "الصم", 'blind': "الكفيف",
        'hyperopia': "طول النظر", 'myopia': "قصر النظر", 'dyslexia': "عسر القراءة"
    };
    return titles[need] || "المحتوى";
}

function getContentDescription(need) {
    const descriptions = {
        'colorBlindness': "مواد معدلة للألوان.", 'deaf': "مواد بلغة الإشارة.", 'blind': "مواد صوتية.",
        'hyperopia': "مواد بحجم خط كبير.", 'myopia': "مواد بحجم خط متوسط.", 'dyslexia': "مواد بخطوط خاصة."
    };
    return descriptions[need] || "اختر طريقة العرض المناسبة.";
}

function announceToScreenReader(message) {
    const announcement = document.getElementById('screenReaderAnnouncement');
    if (announcement) {
        announcement.textContent = message;
        setTimeout(() => { announcement.textContent = ''; }, 150);
    }
}

function toggleControlPanel() {
    const panel = document.getElementById('controlPanel');
    if (panel) panel.classList.toggle('panel-collapsed');
}

// --- LOGOUT FUNCTIONALITY ---
function logout() {
    console.log("Logout function called. Clearing session...");

    // Remove the token and user data from sessionStorage.
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');

    // Announce for accessibility if the function exists.
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader('تم تسجيل الخروج بنجاح');
    }

    // Redirect to the login page.
    window.location.href = '/login.html';
}

// --- INACTIVITY LOGOUT FUNCTIONALITY ---
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        announceToScreenReader('تم تسجيل الخروج بسبب عدم النشاط.');
        logout();
    }, 900000); // 15 minutes
}