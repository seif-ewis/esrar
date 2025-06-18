
// dashoard protection
function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    logout();
    return Promise.reject(new Error('No token found.'));
  }
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers }).then(response => {
    // ✅ If response is 401, token is bad. Logout immediately.
    if (response.status === 401) {
      console.error('Authentication error. Logging out.');
      // Use the existing logout function which removes the token and redirects
      logout(); 
      // Stop processing this failed request
      return Promise.reject(new Error('Unauthorized'));
    }
    return response;
  });
}

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

// حالات النظام
let currentState = {
    currentTab: 'dashboard',
    textSize: 1,
    contentSize: 1,
    currentTheme: 'default',
    editItem: null,
    editType: null,
    confirmCallback: null
};

// قواعد البيانات المحلية (ستكون فارغة، البيانات تأتي من الخادم)
let db = {
    specialties: [],
    courses: [],
    videos: [],
    lectures: [],
    documents: [],
    users: []
};

// تهيئة النظام عند تحميل الصفحة
window.onload = function() {
    // تهيئة حجم النص من التخزين المحلي إذا كان موجودًا
    if (localStorage.getItem('textSize')) {
        adjustSize(localStorage.getItem('textSize'), true);
        document.getElementById('sizeSlider').value = localStorage.getItem('textSize');
    }

    // تهيئة حجم المحتوى من التخزين المحلي إذا كان موجودًا
    if (localStorage.getItem('contentSize')) {
        adjustContentSize(localStorage.getItem('contentSize'), true);
        document.getElementById('contentSizeSlider').value = localStorage.getItem('contentSize');
    }

    // تهيئة الثيم من التخزين المحلي إذا كان موجودًا
    if (localStorage.getItem('theme')) {
        changeTheme(localStorage.getItem('theme'), true);
    }

    // تحميل البيانات الأولية
    loadInitialData();

    // إعداد النماذج
    setupForms();

    // إعداد مخطط الإحصائيات
    setupCharts();

    // إعلان تحميل الصفحة لقارئ الشاشة
    announceToScreenReader('تم تحميل لوحة التحكم الإدارية لنظام التعليم الشامل');
};

// Helper function for screen reader announcements
function announceToScreenReader(message) {
    const srDiv = document.getElementById('screenReaderAnnouncement');
    if (srDiv) {
        srDiv.textContent = message;
    }
}


// تحميل البيانات الأولية من الخادم


async function loadInitialData() {
    try {
        // 1. We've added a fetch call for '/api/users' to get all users from the database
        const [specRes, coursesRes, videosRes, lecturesRes, documentsRes, usersRes] = await Promise.all([
            authFetch('/api/specialties'),
            authFetch('/api/courses'),
            authFetch('/api/videos'),
            authFetch('/api/lectures'),
            authFetch('/api/documents'),
            authFetch('/api/users') // <-- ADDED THIS authFetch
        ]);

        // Error checking now includes the users response
        if (!specRes.ok || !coursesRes.ok || !usersRes.ok) {
            throw new Error(`Failed to load critical initial data.`);
        }

        // Process specialties
        const specialtiesData = await specRes.json();
        db.specialties = specialtiesData.map(item => ({ ...item, id: item._id }));

        // Process courses
        const coursesData = await coursesRes.json();
        db.courses = coursesData.map(item => ({
            ...item,
            id: item._id,
            specialtyId: (item.specialtyId && item.specialtyId._id) ? item.specialtyId._id : item.specialtyId
        }));

        // Helper function to process content
        const normalizeContent = (items) => items.map(item => ({
            ...item,
            id: item._id,
            courseId: (item.courseId && item.courseId._id) ? item.courseId._id : item.courseId
        }));
        
        // Process content
        db.videos = normalizeContent(await videosRes.json());
        db.lectures = normalizeContent(await lecturesRes.json());
        db.documents = normalizeContent(await documentsRes.json());
        
        // 2. We now process the user data from the server
        const usersData = await usersRes.json();
        db.users = usersData.map(item => ({ ...item, id: item._id })); // <-- ADDED THIS PROCESSING

        // 3. Update all UI components, including the user table
        updateAllUI();
        updateStats(); // updateStats relies on db arrays being full
        
        // The renderUsers() function is now called from within updateAllUI() or can be called separately.
        renderUsers(); 

    } catch (err) {
        console.error('Failed to load data:', err);
        showAlert('error', `فشل في تحميل البيانات الأولية: ${err.message || 'خطأ غير معروف'}`);
    }
}

// Add course functionality
// dashboard.js

async function addCourse(courseData) {
    try {
        const response = await authFetch('/api/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseData),
        });

        if (response.ok) {
            let newCourseFromServer = await response.json(); // This comes with a populated specialtyId object

            // ▼▼▼ START OF CHANGE ▼▼▼
            // Create a clean, normalized course object for our local state
            const newCourseForDb = {
                ...newCourseFromServer,
                id: newCourseFromServer._id, // Ensure .id exists
                specialtyId: newCourseFromServer.specialtyId._id // Explicitly use the ._id from the populated object
            };

            db.courses.push(newCourseForDb);
            // ▲▲▲ END OF CHANGE ▲▲▲
            
            renderCourses();
            updateStats();
            showAlert('success', 'تم إضافة المادة بنجاح');
        } else {
            const errorData = await response.json();
            showAlert('error', `فشل في إضافة المادة: ${errorData.message}`);
        }
    } catch (err) {
        showAlert('error', `فشل في إضافة المادة: ${err.message}`);
    }
}

// Helper to escape HTML for safe rendering in input values
function escapeHtml(unsafe) {
    unsafe = (unsafe === undefined || unsafe === null) ? '' : String(unsafe);
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// إعداد النماذج

function setupForms() {
    // --- SPECIALTY FORM (FIXED) ---
    document.getElementById('addSpecialtyForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('specialtyName').value;
        const description = document.getElementById('specialtyDescription').value;
        const icon = document.getElementById('specialtyIcon').value;

        try {
            const response = await authFetch('/api/specialties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, icon })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add specialty');
            }

            const newSpecialty = await response.json();

            // 1. Add to local data
            db.specialties.push({ ...newSpecialty, id: newSpecialty._id });
            // 2. Redraw the table immediately
            renderSpecialties();
            // 3. Update stats and show success message
            updateStats();
            resetForm('addSpecialtyForm');
            showAlert('success', 'تم إضافة التخصص بنجاح');
            announceToScreenReader(`تم إضافة تخصص جديد: ${name}`);

        } catch (err) {
            showAlert('error', `فشل في إضافة التخصص: ${err.message}`);
            console.error('Error adding specialty:', err);
        }
    });

    // --- COURSE FORM (FIXED) ---
    document.getElementById('addCourseForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const specialtyId = document.getElementById('courseSpecialty').value;
        const name = document.getElementById('courseName').value;
        const description = document.getElementById('courseDescription').value;
        const code = document.getElementById('courseCode').value;

        if (!specialtyId) {
            showAlert('error', 'الرجاء اختيار تخصص أولاً');
            return;
        }

        try {
            const response = await authFetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ specialtyId, name, description, code })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add course');
            }

            const newCourse = await response.json();

            // 1. Add to local data (and normalize it)
            const newCourseForDb = {
                ...newCourse,
                id: newCourse._id,
                specialtyId: newCourse.specialtyId._id
            };
            db.courses.push(newCourseForDb);
            // 2. Redraw the table
            renderCourses();
            // 3. Update stats and show success message
            updateStats();
            resetForm('addCourseForm');
            showAlert('success', 'تم إضافة المادة بنجاح');

        } catch (err) {
            showAlert('error', `فشل في إضافة المادة: ${err.message}`);
            console.error('Error adding course:', err);
        }
    });

    // --- VIDEO FORM (FIXED) ---
    document.getElementById('addVideoForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const courseId = document.getElementById('videoCourse').value;
        const title = document.getElementById('videoTitle').value;
        const url = document.getElementById('videoUrl').value;
        const description = document.getElementById('videoDescription').value;
        const duration = parseInt(document.getElementById('videoDuration').value) || 0;
        const accessibilityNeed = document.getElementById('videoAccessibilityNeed').value; 

        if (!courseId) {
            showAlert('error', 'الرجاء اختيار المادة الدراسية');
            return;
        }

        try {
            const response = await authFetch('/api/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId, title, url, description, duration, accessibilityNeed })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add video');
            }

            const newPopulatedVideo = await response.json();

            // 1. Add to local data (and normalize it)
            const newVideoForDb = {
                ...newPopulatedVideo,
                id: newPopulatedVideo._id,
                courseId: newPopulatedVideo.courseId._id
            };
            db.videos.push(newVideoForDb);
            // 2. Redraw the table
            renderVideos();
            // 3. Update stats and show success message
            updateStats();
            resetForm('addVideoForm');
            showAlert('success', 'تم إضافة الفيديو بنجاح');
            announceToScreenReader(`تم إضافة فيديو جديد: ${title}`);

        } catch (err) {
            showAlert('error', `فشل في إضافة الفيديو: ${err.message}`);
            console.error('Error adding video:', err);
        }
    });

    // --- LECTURE FORM (Already Correct for Cloudinary) ---
    document.getElementById('addLectureForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const fileInput = document.getElementById('lectureFile');
        if (!fileInput.files || fileInput.files.length === 0) {
            showAlert('error', 'الرجاء اختيار ملف صوتي للتحميل');
            return;
        }
        try {
            const response = await authFetch('/api/lectures', { method: 'POST', body: formData });
            if (response.ok) {
                const newPopulatedLecture = await response.json();
                const newLectureForDb = { ...newPopulatedLecture, id: newPopulatedLecture._id, courseId: newPopulatedLecture.courseId._id };
                db.lectures.push(newLectureForDb);
                renderLectures();
                updateStats();
                resetForm('addLectureForm');
                showAlert('success', 'تم رفع المحاضرة بنجاح');
            } else {
                const errorData = await response.json();
                showAlert('error', `فشل في رفع المحاضرة: ${errorData.message || 'خطأ من الخادم'}`);
            }
        } catch (err) {
            showAlert('error', 'فشل في رفع المحاضرة');
            console.error('Error adding lecture:', err);
        }
    });

    // --- DOCUMENT FORM (Already Correct for Cloudinary) ---
    document.getElementById('addDocumentForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const fileInput = document.getElementById('documentFile');
        if (!fileInput.files || fileInput.files.length === 0) {
            showAlert('error', 'الرجاء اختيار ملف للتحميل');
            return;
        }
        try {
            const response = await authFetch('/api/documents', { method: 'POST', body: formData });
            if (response.ok) {
                const newPopulatedDocument = await response.json();
                const newDocumentForDb = { ...newPopulatedDocument, id: newPopulatedDocument._id, courseId: newPopulatedDocument.courseId._id };
                db.documents.push(newDocumentForDb);
                renderDocuments();
                updateStats();
                resetForm('addDocumentForm');
                showAlert('success', 'تم رفع الوثيقة بنجاح');
            } else {
                const errorData = await response.json();
                showAlert('error', `فشل في رفع الوثيقة: ${errorData.message || 'خطأ من الخادم'}`);
            }
        } catch (err) {
            showAlert('error', 'فشل في رفع الوثيقة');
            console.error('Error adding document:', err);
        }
    });

    // --- USER FORM (This is a local-only form, no fetch needed) ---
document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const confirmPassword = document.getElementById('userConfirmPassword').value;
    const role = document.getElementById('userRole').value;

    if (password !== confirmPassword) {
        showAlert('error', 'كلمة المرور وتأكيدها غير متطابقين');
        return;
    }

    const userData = { name, email, password, role };

    // IMPROVEMENT: Disable the button to prevent multiple clicks while processing
    const submitButton = this.querySelector('button[type="submit"]');
    const originalButtonHtml = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> جاري الحفظ...</span>';

    try {
        const response = await authFetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const newUserFromServer = await response.json();

        if (!response.ok) {
            // Use the error message from the server if available
            throw new Error(newUserFromServer.message || 'فشل في إنشاء المستخدم');
        }
        
        // --- THIS IS THE FIX ---
        // The server returns the complete, validated user object. Use it directly.
        // This ensures all data, especially the ID, is correct.
        if (newUserFromServer && newUserFromServer._id) {
            // Ensure the 'id' property also exists for consistency with the rest of the app.
            newUserFromServer.id = newUserFromServer._id; 
            db.users.push(newUserFromServer); // Add the correct object from the server.
        } else {
            // This is a safeguard in case the server response is malformed.
            throw new Error('لم يتم استلام بيانات المستخدم بشكل صحيح من الخادم.');
        }
        // --- END OF FIX ---

        renderUsers();
        updateStats();
        resetForm('addUserForm');
        showAlert('success', 'تم إضافة المستخدم بنجاح');

    } catch (err) {
        showAlert('error', `فشل في إضافة المستخدم: ${err.message}`);
    } finally {
        // IMPROVEMENT: Always re-enable the button and restore its text,
        // whether the operation succeeded or failed.
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
    }
});

    // --- FILTERS ---
    document.getElementById('filterCourses').addEventListener('change', () => renderCourses());
    // Video Filters
    document.getElementById('filterVideos').addEventListener('change', () => renderVideos());
    document.getElementById('filterVideosByNeed').addEventListener('change', () => renderVideos()); 
    // Lecture Filters
    document.getElementById('filterLectures').addEventListener('change', () => renderLectures());
    document.getElementById('filterLecturesByNeed').addEventListener('change', () => renderLectures()); 
    // Document Filters
    document.getElementById('filterDocuments').addEventListener('change', () => renderDocuments());
    document.getElementById('filterDocumentsByNeed').addEventListener('change', () => renderDocuments()); 
    document.getElementById('filterUsers').addEventListener('change', () => renderUsers());
}




// إعداد مخططات الإحصائيات
// dashboard.js

// Store the chart instance globally to prevent duplicates
let myVisitsChart = null;

async function setupCharts() {
    // If a chart instance already exists, destroy it before creating a new one
    if (myVisitsChart) {
        myVisitsChart.destroy();
    }

    const ctx = document.getElementById('visitsChart').getContext('2d');

    try {
        // Fetch the visit statistics from our new backend endpoint
        const response = await authFetch('/api/visits/stats');
        if (!response.ok) {
            throw new Error('Failed to fetch visit stats');
        }
        const stats = await response.json();

        // Process the data for Chart.js
        const labels = stats.map(stat => stat._id); // Dates
        const data = stats.map(stat => stat.count); // Visit counts

        const visitsData = {
            labels: labels,
            datasets: [{
                label: 'عدد الزيارات',
                data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };

        // Create the new Chart instance
        myVisitsChart = new Chart(ctx, {
            type: 'line',
            data: visitsData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        rtl: true
                    },
                    tooltip: {
                        rtl: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error setting up charts:', error);
        // You can display an error message on the chart canvas if needed
        ctx.font = '16px Tajawal';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('فشل في تحميل بيانات الإحصائيات', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

// تحديث الإحصائيات
function updateStats() {
    document.getElementById('specialtiesCount').textContent = db.specialties.length;
    document.getElementById('coursesCount').textContent = db.courses.length;
    document.getElementById('videosCount').textContent = db.videos.length;
    document.getElementById('usersCount').textContent = db.users.length;
}

// عرض التخصصات في الجدول
function renderSpecialties() {
    const tableBody = document.getElementById('specialtiesTable');
    tableBody.innerHTML = '';
    updateSpecialtySelects();
    if (db.specialties.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'text-center';
        cell.textContent = 'لا توجد تخصصات مسجلة';
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }
    db.specialties.forEach((specialty, index) => {
        // Use specialty._id for API calls if that's what your backend expects
        const itemId = specialty.id || specialty._id;
        const coursesCount = db.courses.filter(c => String(c.specialtyId) === String(itemId)).length;
        const row = document.createElement('tr');
        // Index
        const tdIndex = document.createElement('td');
        tdIndex.textContent = (index + 1).toString();
        row.appendChild(tdIndex);
        // Icon + Name
        const tdName = document.createElement('td');
        const icon = document.createElement('i');
        icon.className = specialty.icon;
        tdName.appendChild(icon);
        tdName.appendChild(document.createTextNode(' '));
        tdName.appendChild(document.createTextNode(specialty.name));
        row.appendChild(tdName);
        // Description
        const tdDesc = document.createElement('td');
        tdDesc.textContent = ((specialty.description || '').substring(0, 50)) + '...';
        row.appendChild(tdDesc);
        // Courses count
        const tdCount = document.createElement('td');
        tdCount.textContent = coursesCount.toString();
        row.appendChild(tdCount);
        // Actions
        const tdActions = document.createElement('td');
        tdActions.className = 'actions';
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-primary btn-sm';
        editBtn.type = 'button';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> تعديل';
        editBtn.onclick = function() { editItem('specialty', itemId); };
        tdActions.appendChild(editBtn);
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.type = 'button';
        delBtn.innerHTML = '<i class="fas fa-trash"></i> حذف';
        delBtn.onclick = function() { confirmDelete('specialty', itemId, specialty.name); };
        tdActions.appendChild(delBtn);
        row.appendChild(tdActions);
        tableBody.appendChild(row);
    });
}

// عرض المواد في الجدول
function renderCourses() {
    const tableBody = document.getElementById('coursesTable');
    tableBody.innerHTML = '';

    // تحديث قائمة المواد في نماذج الإضافة
    updateCourseSelects();

    const filterValue = document.getElementById('filterCourses').value;
    let filteredCourses = db.courses;

    if (filterValue !== 'all') {
        filteredCourses = db.courses.filter(c => String(c.specialtyId) === String(filterValue));
    }

    if (filteredCourses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">لا توجد مواد مسجلة</td>
            </tr>
        `;
        return;
    }

    filteredCourses.forEach((course, index) => {
        const specialty = db.specialties.find(s => s.id === course.specialtyId);
        const specialtyName = specialty ? specialty.name : 'غير معروف';
        const itemId = course.id || course._id; // Use _id for API calls if that's what your backend expects

        // Fix: Always show course name in the second column
        const courseName = course.name || course.courseName || 'اسم المادة غير متوفر';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(courseName)}</td>
            <td>${escapeHtml(specialtyName)}</td>
            <td>${escapeHtml(course.description ? course.description.substring(0, 50) : '')}...</td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="editItem('course', '${itemId}')">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn btn-danger btn-sm" onclick="confirmDelete('course', '${itemId}', '${escapeHtml(courseName)}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// عرض الفيديوهات في الجدول
// In public/js/dashboard.js
// In public/js/dashboard.js
async function renderVideos() {
    const tableBody = document.getElementById('videosTable');
    // CHANGE 1: The colspan is now 6 because we added a new column.
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">جاري تحميل الفيديوهات...</td></tr>';

    // CHANGE 2: Add this helper object to translate category names.
    const accessibilityMap = {
        general: 'عام',
        colorBlindness: 'عمى الألوان',
        deaf: 'الصم',
        blind: 'الكفيف',
        hyperopia: 'طول النظر',
        myopia: 'قصر النظر',
        dyslexia: 'عسر القراءة'
    };

    // 1. Get filter values
    const courseId = document.getElementById('filterVideos').value;
    const accessibilityNeed = document.getElementById('filterVideosByNeed').value;

    // 2. Build the API URL with query parameters
    let apiUrl = '/api/videos?';
    if (courseId !== 'all') {
        apiUrl += `courseId=${courseId}&`;
    }
    if (accessibilityNeed !== 'all') {
        apiUrl += `accessibilityNeed=${accessibilityNeed}&`;
    }

    try {
        // 3. Fetch filtered data from the server
        const response = await authFetch(apiUrl);
        if (!response.ok) {
            throw new Error('فشل في تحميل الفيديوهات');
        }
        const videos = await response.json();
        db.videos = videos.map(item => ({ ...item, id: item._id, courseId: (item.courseId?._id || item.courseId) }));
        
        // 4. Render the results
        tableBody.innerHTML = '';
        if (db.videos.length === 0) {
            // CHANGE 3: The colspan is also 6 here.
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">لا توجد فيديوهات تطابق هذه الفلاتر.</td></tr>`;
            return;
        }

        db.videos.forEach((video, index) => {
            const course = db.courses.find(c => String(c.id) === String(video.courseId));
            const courseName = course ? course.name : 'غير معروف';
            const itemId = video.id;
            // CHANGE 4: Get the readable category name from the map.
            const categoryName = accessibilityMap[video.accessibilityNeed] || video.accessibilityNeed;
            const row = document.createElement('tr');
            // CHANGE 5: The entire innerHTML is updated to include the new cell.
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(video.title)}</td>
                <td>${escapeHtml(courseName)}</td>
                <td>${video.duration || 'N/A'} دقيقة</td>
                <td>${escapeHtml(categoryName)}</td>
                <td class="actions">
                    <button class="btn btn-primary btn-sm" onclick="editItem('video', '${itemId}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('video', '${itemId}', '${escapeHtml(video.title)}')"><i class="fas fa-trash"></i> حذف</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        // CHANGE 6: And finally, the colspan is 6 in the error message.
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">خطأ في تحميل البيانات.</td></tr>`;
        console.error('Error fetching videos:', err);
    }
}



// عرض المحاضرات في الجدول
async function renderLectures() {
    const tableBody = document.getElementById('lecturesTable');
    // CHANGE 1: The colspan is now 6.
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">جاري تحميل المحاضرات...</td></tr>';

    // CHANGE 2: Add the map for translating category names.
    const accessibilityMap = {
        general: 'عام',
        colorBlindness: 'عمى الألوان',
        deaf: 'الصم',
        blind: 'الكفيف',
        hyperopia: 'طول النظر',
        myopia: 'قصر النظر',
        dyslexia: 'عسر القراءة'
    };

    const courseId = document.getElementById('filterLectures').value;
    const accessibilityNeed = document.getElementById('filterLecturesByNeed').value;

    let apiUrl = '/api/lectures?';
    if (courseId !== 'all') {
        apiUrl += `courseId=${courseId}&`;
    }
    if (accessibilityNeed !== 'all') {
        apiUrl += `accessibilityNeed=${accessibilityNeed}&`;
    }

    try {
        const response = await authFetch(apiUrl);
        if (!response.ok) throw new Error('فشل في تحميل المحاضرات');
        const lectures = await response.json();
        db.lectures = lectures.map(item => ({ ...item, id: item._id, courseId: (item.courseId?._id || item.courseId) }));

        tableBody.innerHTML = '';
        if (db.lectures.length === 0) {
            // CHANGE 3: The colspan is 6 here too.
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">لا توجد محاضرات تطابق هذه الفلاتر.</td></tr>`;
            return;
        }

        db.lectures.forEach((lecture, index) => {
            const course = db.courses.find(c => String(c.id) === String(lecture.courseId));
            const courseName = course ? course.name : 'غير معروف';
            const itemId = lecture.id;
            // CHANGE 4: Get the readable category name.
            const categoryName = accessibilityMap[lecture.accessibilityNeed] || lecture.accessibilityNeed;
            const row = document.createElement('tr');
            // CHANGE 5: Update the row's HTML to include the new category cell.
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(lecture.title)}</td>
                <td>${escapeHtml(courseName)}</td>
                <td>${lecture.duration || 'N/A'} دقيقة</td>
                <td>${escapeHtml(categoryName)}</td>
                <td class="actions">
                    <button class="btn btn-primary btn-sm" onclick="editItem('lecture', '${itemId}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('lecture', '${itemId}', '${escapeHtml(lecture.title)}')"><i class="fas fa-trash"></i> حذف</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        // CHANGE 6: Update the colspan in the error message.
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">خطأ في تحميل البيانات.</td></tr>`;
        console.error('Error fetching lectures:', err);
    }
}

// عرض الوثائق في الجدول
// In public/js/dashboard.js
async function renderDocuments() {
    const tableBody = document.getElementById('documentsTable');
    // CHANGE 1: The colspan is now 6.
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">جاري تحميل الوثائق...</td></tr>';

    // CHANGE 2: Add the map for translating category names.
    const accessibilityMap = {
        general: 'عام',
        colorBlindness: 'عمى الألوان',
        deaf: 'الصم',
        blind: 'الكفيف',
        hyperopia: 'طول النظر',
        myopia: 'قصر النظر',
        dyslexia: 'عسر القراءة'
    };

    const courseId = document.getElementById('filterDocuments').value;
    const accessibilityNeed = document.getElementById('filterDocumentsByNeed').value;

    let apiUrl = '/api/documents?';
    if (courseId !== 'all') {
        apiUrl += `courseId=${courseId}&`;
    }
    if (accessibilityNeed !== 'all') {
        apiUrl += `accessibilityNeed=${accessibilityNeed}&`;
    }

    try {
        const response = await authFetch(apiUrl);
        if (!response.ok) throw new Error('فشل في تحميل الوثائق');
        const documents = await response.json();
        db.documents = documents.map(item => ({ ...item, id: item._id, courseId: (item.courseId?._id || item.courseId) }));
        
        tableBody.innerHTML = '';
        if (db.documents.length === 0) {
            // CHANGE 3: The colspan is 6 here too.
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">لا توجد وثائق تطابق هذه الفلاتر.</td></tr>`;
            return;
        }

        db.documents.forEach((doc, index) => {
            const course = db.courses.find(c => String(c.id) === String(doc.courseId));
            const courseName = course ? course.name : 'غير معروف';
            const itemId = doc.id;
            const typeNames = {'lecture': 'محاضرة', 'summary': 'ملخص', 'exercise': 'تمارين', 'exam': 'امتحان', 'other': 'أخرى'};
            // CHANGE 4: Get the readable category name.
            const categoryName = accessibilityMap[doc.accessibilityNeed] || doc.accessibilityNeed;
            const row = document.createElement('tr');
            // CHANGE 5: Update the row's HTML to include the new category cell.
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(doc.title)}</td>
                <td>${escapeHtml(courseName)}</td>
                <td>${typeNames[doc.type] || escapeHtml(doc.type)}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td class="actions">
                    <a href="${escapeHtml(doc.fileUrl)}" class="btn btn-primary btn-sm" download><i class="fas fa-download"></i> تحميل</a>
                    <button class="btn btn-primary btn-sm" onclick="editItem('document', '${itemId}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('document', '${itemId}', '${escapeHtml(doc.title)}')"><i class="fas fa-trash"></i> حذف</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        // CHANGE 6: Update the colspan in the error message.
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">خطأ في تحميل البيانات.</td></tr>`;
        console.error('Error fetching documents:', err);
    }
}
// عرض المستخدمين في الجدول
function renderUsers() {
    const tableBody = document.getElementById('usersTable');
    tableBody.innerHTML = '';

    const filterValue = document.getElementById('filterUsers').value;
    let filteredUsers = db.users;

    if (filterValue !== 'all') {
        filteredUsers = db.users.filter(u => u.role === filterValue);
    }

    if (filteredUsers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">لا توجد مستخدمين مسجلين</td>
            </tr>
        `;
        return;
    }

    filteredUsers.forEach((user, index) => {
        const roleNames = {
            'admin': 'مدير النظام',
            'student': 'طالب'
        };
        const itemId = user.id || user._id; // Use _id for API calls if that's what your backend expects

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${roleNames[user.role] || escapeHtml(user.role)}</td>
            <td>
                <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">
                    ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="editItem('user', '${itemId}')">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn btn-danger btn-sm" onclick="confirmDelete('user', '${itemId}', '${escapeHtml(user.name)}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// عرض آخر المواد المضافة
function renderRecentCourses() {
    const tableBody = document.getElementById('recentCoursesTable');
    tableBody.innerHTML = '';

    // ترتيب المواد حسب تاريخ الإضافة (الأحدث أولاً)
    const recentCourses = [...db.courses]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (recentCourses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">لا توجد مواد مسجلة</td>
            </tr>
        `;
        return;
    }

    recentCourses.forEach((course, index) => {
        const specialty = db.specialties.find(s => s.id === course.specialtyId);
        const specialtyName = specialty ? specialty.name : 'غير معروف';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(course.name)}</td>
            <td>${escapeHtml(specialtyName)}</td>
            <td>${escapeHtml(course.createdAt)}</td>
            <td>
                <span class="badge badge-primary">نشط</span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


function updateAllUI() {
    // These functions will redraw all the tables and update all the dropdowns
    renderSpecialties();
    renderCourses();
    renderVideos();
    renderLectures();
    renderDocuments();
    renderRecentCourses();
}



// تحديث قوائم التخصصات في نماذج الإضافة
function updateSpecialtySelects() {
    const specialtySelects = [
        document.getElementById('courseSpecialty'),
        document.getElementById('filterCourses'),
        document.getElementById('videoCourse'),
        document.getElementById('lectureCourse'),
        document.getElementById('documentCourse'),
        document.getElementById('filterVideos'),
        document.getElementById('filterLectures'),
        document.getElementById('filterDocuments')
    ];

    specialtySelects.forEach(select => {
        if (!select) return;

        // حفظ القيمة المحددة حالياً
        const currentValue = select.value;

        // مسح الخيارات الحالية (مع الاحتفاظ بالخيار الأول إذا كان موجودًا)
        while (select.options.length > (select.id.startsWith('filter') ? 1 : 0)) {
            select.remove(select.options.length - 1);
        }

        // إضافة التخصصات الجديدة
        db.specialties.forEach(specialty => {
            const option = document.createElement('option');
            option.value = specialty.id; // Use 'id' (which maps to _id)
            option.textContent = specialty.name;
            select.appendChild(option);
        });

        // استعادة القيمة المحددة إذا كانت لا تزال موجودة
        if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// تحديث قوائم المواد في نماذج الإضافة
function updateCourseSelects() {
    const courseSelects = [
        document.getElementById('videoCourse'),
        document.getElementById('lectureCourse'),
        document.getElementById('documentCourse'),
        document.getElementById('filterVideos'),
        document.getElementById('filterLectures'),
        document.getElementById('filterDocuments')
    ];

    courseSelects.forEach(select => {
        if (!select) return;

        // حفظ القيمة المحددة حالياً
        const currentValue = select.value;

        // مسح الخيارات الحالية (مع الاحتفاظ بالخيار الأول إذا كان موجودًا)
        while (select.options.length > (select.id.startsWith('filter') ? 1 : 0)) {
            select.remove(select.options.length - 1);
        }

        // إضافة المواد الجديدة
        db.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id; // Use 'id' (which maps to _id)
            option.textContent = course.name;
            select.appendChild(option);
        });

        // استعادة القيمة المحددة إذا كانت لا تزال موجودة
        if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

// فتح تبويب في لوحة التحكم
function openAdminTab(tabId) {
    // إخفاء جميع التبويبات
    document.querySelectorAll('.admin-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // إلغاء تنشيط جميع أزرار التبويبات
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // إظهار التبويب المحدد
    document.getElementById(`${tabId}Tab`).classList.add('active');

    // تنشيط زر التبويب المحدد
    document.querySelector(`.admin-tab[onclick="openAdminTab('${tabId}')"]`).classList.add('active');

    // تحديث حالة التبويب الحالي
    currentState.currentTab = tabId;

    // إعلان تغيير التبويب لقارئ الشاشة
    const tabNames = {
        'dashboard': 'لوحة التحكم',
        'specialties': 'التخصصات',
        'courses': 'المواد الدراسية',
        'videos': 'الفيديوهات',
        'lectures': 'المحاضرات',
        'documents': 'الوثائق',
        'users': 'المستخدمون'
    };

    announceToScreenReader(`تم فتح تبويب ${tabNames[tabId]}`);
}

// تعديل عنصر


async function editItem(type, id) {
    currentState.editItem = id;
    currentState.editType = type;
    const editModal = document.getElementById('editModal');
    const editModalTitle = document.getElementById('editModalTitle');
    const editModalBody = document.getElementById('editModalBody');

    editModalBody.innerHTML = '<div class="loader"></div>';
    editModalTitle.textContent = 'جاري التحميل...';
    editModal.classList.add('active');

    try {
        const endpoint = `/api/${type}s/${id}`;
        
        const response = await authFetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to fetch item data (status: ${response.status})`);
        }
        const itemToEdit = await response.json();
        let formHtml = '';

        // --- Helper for creating the accessibility dropdown ---
        const needs = [
            { value: 'general', text: 'عام (General)' },
            { value: 'colorBlindness', text: 'عمى الألوان (Color Blindness)' },
            { value: 'deaf', text: 'الصم (Deaf)' },
            { value: 'blind', text: 'الكفيف (Blind)' },
            { value: 'hyperopia', text: 'طول النظر (Hyperopia)' },
            { value: 'myopia', text: 'قصر النظر (Myopia)' },
            { value: 'dyslexia', text: 'عسر القراءة (Dyslexia)' }
        ];

        const getNeedsDropdown = (selectedNeed, selectId) => {
            const options = needs.map(need => 
                `<option value="${need.value}" ${selectedNeed === need.value ? 'selected' : ''}>${need.text}</option>`
            ).join('');
            return `
                <div class="form-group">
                    <label class="form-label">الفئة المخصصة (Accessibility Need)</label>
                    <select class="form-control" id="${selectId}" name="accessibilityNeed">${options}</select>
                </div>
            `;
        };
        // --- End helper ---

        switch (type) {
            case 'specialty':
                editModalTitle.textContent = 'تعديل التخصص';
                formHtml = `
                    <div class="form-group"><label class="form-label">اسم التخصص</label><input type="text" class="form-control" id="editSpecialtyName" value="${escapeHtml(itemToEdit.name)}" required></div>
                    <div class="form-group"><label class="form-label">وصف التخصص</label><textarea class="form-control form-textarea" id="editSpecialtyDescription" required>${escapeHtml(itemToEdit.description)}</textarea></div>
                    <div class="form-group"><label class="form-label">أيقونة التخصص</label><input type="text" class="form-control" id="editSpecialtyIcon" value="${escapeHtml(itemToEdit.icon)}"></div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('specialty', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>`;
                break;
                
            case 'course':
                const courseSpecialtyId = (itemToEdit.specialtyId && itemToEdit.specialtyId._id) ? itemToEdit.specialtyId._id : itemToEdit.specialtyId;
                editModalTitle.textContent = 'تعديل المادة';
                formHtml = `
                    <div class="form-group"><label class="form-label">التخصص</label><select class="form-control" id="editCourseSpecialty" required>${db.specialties.map(s => `<option value="${s.id}" ${s.id === courseSpecialtyId ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">اسم المادة</label><input type="text" class="form-control" id="editCourseName" value="${escapeHtml(itemToEdit.name)}" required></div>
                    <div class="form-group"><label class="form-label">وصف المادة</label><textarea class="form-control form-textarea" id="editCourseDescription" required>${escapeHtml(itemToEdit.description)}</textarea></div>
                    <div class="form-group"><label class="form-label">رمز المادة</label><input type="text" class="form-control" id="editCourseCode" value="${escapeHtml(itemToEdit.code || '')}"></div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('course', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>`;
                break;

            case 'video':
                const videoCourseId = (itemToEdit.courseId && itemToEdit.courseId._id) ? itemToEdit.courseId._id : itemToEdit.courseId;
                editModalTitle.textContent = 'تعديل الفيديو';
                formHtml = `
                    <div class="form-group"><label class="form-label">المادة الدراسية</label><select class="form-control" id="editVideoCourse" required>${db.courses.map(c => `<option value="${c.id}" ${c.id === videoCourseId ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">عنوان الفيديو</label><input type="text" class="form-control" id="editVideoTitle" value="${escapeHtml(itemToEdit.title)}" required></div>
                    <div class="form-group"><label class="form-label">رابط الفيديو (YouTube)</label><input type="url" class="form-control" id="editVideoUrl" value="${escapeHtml(itemToEdit.url)}" required></div>
                    ${getNeedsDropdown(itemToEdit.accessibilityNeed, 'editVideoAccessibilityNeed')}
                    <div class="form-group"><label class="form-label">وصف الفيديو</label><textarea class="form-control form-textarea" id="editVideoDescription" required>${escapeHtml(itemToEdit.description)}</textarea></div>
                    <div class="form-group"><label class="form-label">مدة الفيديو (دقائق)</label><input type="number" class="form-control" id="editVideoDuration" value="${itemToEdit.duration || ''}"></div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('video', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>`;
                break;

            case 'lecture':
                const lectureCourseId = (itemToEdit.courseId && itemToEdit.courseId._id) ? itemToEdit.courseId._id : itemToEdit.courseId;
                editModalTitle.textContent = 'تعديل المحاضرة';
                formHtml = `
                    <div class="form-group"><label class="form-label">المادة الدراسية</label><select class="form-control" id="editLectureCourse" required>${db.courses.map(c => `<option value="${c.id}" ${c.id === lectureCourseId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">عنوان المحاضرة</label><input type="text" class="form-control" id="editLectureTitle" value="${escapeHtml(itemToEdit.title)}" required></div>
                    ${getNeedsDropdown(itemToEdit.accessibilityNeed, 'editLectureAccessibilityNeed')}
                    <div class="form-group"><label class="form-label">ملف المحاضرة الحالي</label><div><a href="${itemToEdit.fileUrl}" target="_blank" class="btn btn-info btn-sm" download><i class="fas fa-download"></i> تحميل الملف الحالي</a></div></div>
                    <div class="form-group"><label class="form-label">تغيير ملف المحاضرة (اختياري)</label><input type="file" class="form-control" id="editLectureFile" accept="audio/*"></div>
                    <div class="form-group"><label class="form-label">وصف المحاضرة</label><textarea class="form-control form-textarea" id="editLectureDescription" required>${escapeHtml(itemToEdit.description || '')}</textarea></div>
                    <div class="form-group"><label class="form-label">مدة المحاضرة (دقائق)</label><input type="number" class="form-control" id="editLectureDuration" value="${itemToEdit.duration || 0}"></div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('lecture', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>`;
                break;

            case 'document':
                const documentCourseId = (itemToEdit.courseId && itemToEdit.courseId._id) ? itemToEdit.courseId._id : itemToEdit.courseId;
                editModalTitle.textContent = 'تعديل الوثيقة';
                formHtml = `
                    <div class="form-group"><label class="form-label">المادة الدراسية</label><select class="form-control" id="editDocumentCourse" required>${db.courses.map(c => `<option value="${c.id}" ${c.id === documentCourseId ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">عنوان الوثيقة</label><input type="text" class="form-control" id="editDocumentTitle" value="${escapeHtml(itemToEdit.title)}" required></div>
                    ${getNeedsDropdown(itemToEdit.accessibilityNeed, 'editDocumentAccessibilityNeed')}
                    <div class="form-group"><label class="form-label">ملف الوثيقة الحالي</label><div><a href="${itemToEdit.fileUrl}" target="_blank" class="btn btn-info btn-sm" download><i class="fas fa-download"></i> تحميل الملف الحالي</a></div></div>
                    <div class="form-group"><label class="form-label">تغيير ملف الوثيقة (اختياري)</label><input type="file" class="form-control" id="editDocumentFile" accept=".pdf,.doc,.docx,.ppt,.pptx"></div>
                    <div class="form-group"><label class="form-label">نوع الوثيقة</label><select class="form-control" id="editDocumentType"><option value="lecture" ${itemToEdit.type === 'lecture' ? 'selected' : ''}>محاضرة</option><option value="summary" ${itemToEdit.type === 'summary' ? 'selected' : ''}>ملخص</option><option value="exercise" ${itemToEdit.type === 'exercise' ? 'selected' : ''}>تمارين</option><option value="exam" ${itemToEdit.type === 'exam' ? 'selected' : ''}>امتحان</option><option value="other" ${itemToEdit.type === 'other' ? 'selected' : ''}>أخرى</option></select></div>
                    <div class="form-group"><label class="form-label">وصف الوثيقة</label><textarea class="form-control form-textarea" id="editDocumentDescription">${escapeHtml(itemToEdit.description || '')}</textarea></div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('document', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>`;
                break;
            
            // --- CORRECTED 'USER' CASE ---
            case 'user':
                editModalTitle.textContent = 'تعديل المستخدم';
                const userRole = itemToEdit.role || 'student';
                formHtml = `
                    <div class="form-group">
                        <label class="form-label">اسم المستخدم</label>
                        <input type="text" class="form-control" id="editUserName" value="${escapeHtml(itemToEdit.name)}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">البريد الإلكتروني</label>
                        <input type="email" class="form-control" id="editUserEmail" value="${escapeHtml(itemToEdit.email)}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">كلمة المرور الجديدة (اختياري)</label>
                        <input type="password" class="form-control" id="editUserPassword" placeholder="اترك الحقل فارغاً لعدم التغيير">
                    </div>
                    <div class="form-group">
                        <label class="form-label">تأكيد كلمة المرور</label>
                        <input type="password" class="form-control" id="editUserConfirmPassword" placeholder="أعد كتابة كلمة المرور الجديدة">
                    </div>
                    <div class="form-group">
                        <label class="form-label">نوع المستخدم</label>
                        <select class="form-control" id="editUserRole">
                            <option value="admin" ${userRole === 'admin' ? 'selected' : ''}>مدير النظام</option>
                            <option value="student" ${userRole === 'student' ? 'selected' : ''}>طالب</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">الحالة</label>
                        <select class="form-control" id="editUserStatus">
                            <option value="active" ${itemToEdit.status === 'active' ? 'selected' : ''}>نشط</option>
                            <option value="inactive" ${itemToEdit.status !== 'active' ? 'selected' : ''}>غير نشط</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="saveEdit('user', '${id}')"><i class="fas fa-save"></i> حفظ التغييرات</button>
                `;
                break;
                
            default:
                formHtml = '<p>لا يوجد نموذج تعديل متاح لهذا النوع.</p>';
                editModalTitle.textContent = 'خطأ';
        }
        editModalBody.innerHTML = formHtml;
    } catch (err) {
        showAlert('error', `فشل في تحميل بيانات العنصر: ${err.message}`);
        closeEditModal();
    }
}



// حفظ التعديلات


async function saveEdit(type, id) {
    const saveBtn = document.querySelector('#editModalBody button[onclick^="saveEdit"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    // --- FIX 1: Handle 'specialty' endpoint name correctly ---
    const endpoint = (type === 'specialty') ? `/api/specialties/${id}` : `/api/${type}s/${id}`;
    
    let body;
    let headers = {};
    let method = 'PUT';

    const lectureFile = document.getElementById('editLectureFile')?.files[0];
    const documentFile = document.getElementById('editDocumentFile')?.files[0];

    // Check if a new file is being uploaded
    if ((type === 'lecture' && lectureFile) || (type === 'document' && documentFile)) {
        body = new FormData();
        if (type === 'lecture') {
            body.append('courseId', document.getElementById('editLectureCourse').value);
            body.append('title', document.getElementById('editLectureTitle').value);
            body.append('description', document.getElementById('editLectureDescription').value);
            body.append('duration', parseInt(document.getElementById('editLectureDuration').value) || 0);
            body.append('lectureFile', lectureFile);
            body.append('accessibilityNeed', document.getElementById('editLectureAccessibilityNeed').value);
        } else { // Document
            body.append('courseId', document.getElementById('editDocumentCourse').value);
            body.append('title', document.getElementById('editDocumentTitle').value);
            body.append('description', document.getElementById('editDocumentDescription').value); // <-- FIX 2: Added missing description
            body.append('type', document.getElementById('editDocumentType').value);
            body.append('documentFile', documentFile);
            body.append('accessibilityNeed', document.getElementById('editDocumentAccessibilityNeed').value);
        }
    } else {
        // If no new file, send data as JSON
        headers['Content-Type'] = 'application/json';
        let updatedData = {};
        switch (type) {
            case 'specialty':
                updatedData = { name: document.getElementById('editSpecialtyName').value, description: document.getElementById('editSpecialtyDescription').value, icon: document.getElementById('editSpecialtyIcon').value };
                break;
            case 'course':
                updatedData = { specialtyId: document.getElementById('editCourseSpecialty').value, name: document.getElementById('editCourseName').value, description: document.getElementById('editCourseDescription').value, code: document.getElementById('editCourseCode').value };
                break;
            case 'video':
                updatedData = { 
                    courseId: document.getElementById('editVideoCourse').value, 
                    title: document.getElementById('editVideoTitle').value, 
                    url: document.getElementById('editVideoUrl').value, 
                    description: document.getElementById('editVideoDescription').value, 
                    duration: parseInt(document.getElementById('editVideoDuration').value) || 0,
                    accessibilityNeed: document.getElementById('editVideoAccessibilityNeed').value
                };
                break;
            case 'lecture':
                 updatedData = { 
                     courseId: document.getElementById('editLectureCourse').value, 
                     title: document.getElementById('editLectureTitle').value, 
                     description: document.getElementById('editLectureDescription').value, 
                     duration: parseInt(document.getElementById('editLectureDuration').value) || 0,
                     accessibilityNeed: document.getElementById('editLectureAccessibilityNeed').value
                 };
                 break;
            case 'document':
                updatedData = { 
                    courseId: document.getElementById('editDocumentCourse').value, 
                    title: document.getElementById('editDocumentTitle').value, 
                    description: document.getElementById('editDocumentDescription').value, // <-- FIX 2: Added missing description
                    type: document.getElementById('editDocumentType').value,
                    accessibilityNeed: document.getElementById('editDocumentAccessibilityNeed').value
                };
                break;
            case 'user':
                updatedData = { 
                    name: document.getElementById('editUserName').value,
                    email: document.getElementById('editUserEmail').value,
                    role: document.getElementById('editUserRole').value,
                    status: document.getElementById('editUserStatus').value
                };

                const newPassword = document.getElementById('editUserPassword').value;
                const confirmPassword = document.getElementById('editUserConfirmPassword').value;

                if (newPassword) {
                    if (newPassword !== confirmPassword) {
                        showAlert('error', 'كلمة المرور الجديدة وتأكيدها غير متطابقين.');
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
                        }
                        return;
                    }
                    updatedData.password = newPassword;
                }
                break;
        }
        body = JSON.stringify(updatedData);
    }

    try {
        const response = await authFetch(endpoint, {
            method: method,
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.message || 'فشل في تحديث العنصر');
        }

        const updatedItemFromServer = await response.json();
        
        const normalizedItem = { ...updatedItemFromServer, id: updatedItemFromServer._id };
        if (normalizedItem.courseId && typeof normalizedItem.courseId === 'object') { normalizedItem.courseId = normalizedItem.courseId._id; }
        if (normalizedItem.specialtyId && typeof normalizedItem.specialtyId === 'object') { normalizedItem.specialtyId = normalizedItem.specialtyId._id; }
        
        // --- FIX 3: Handle 'specialty' key correctly for local data update ---
        const dbKey = (type === 'specialty') ? 'specialties' : `${type}s`;
        const targetDb = db[dbKey];
        
        if (targetDb) {
            const index = targetDb.findIndex(item => item.id === id);
            if (index !== -1) {
                targetDb[index] = normalizedItem;
            } else {
                targetDb.push(normalizedItem); // If not found, add it
            }
        }
        
        const renderMap = { specialty: renderSpecialties, course: renderCourses, video: renderVideos, lecture: renderLectures, document: renderDocuments, user: renderUsers };
        if(renderMap[type]) renderMap[type]();
        
        // If a core item like a course or specialty is updated, refresh everything
        if(type === 'course' || type === 'specialty') updateAllUI(); 

        updateStats();
        showAlert('success', 'تم تحديث العنصر بنجاح');
        closeEditModal();

    } catch (err) {
        showAlert('error', err.message);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ التغييرات';
        }
    }
}

// تأكيد الحذف
function confirmDelete(type, id, name) {
    if (id === undefined || id === null) {
        showAlert('error', `معرف العنصر غير صالح للحذف: ${name}`);
        console.error(`Invalid id for confirmDelete: type=${type}, id=${id}, name=${name}`);
        return;
    }
    currentState.editType = type;
    currentState.editItem = { id, name };

    document.getElementById('confirmModalTitle').textContent = `حذف ${name}`;
    document.getElementById('confirmModalBody').textContent = `هل أنت متأكد من أنك تريد حذف ${name}؟`;

    document.getElementById('confirmActionBtn').onclick = function() {
        deleteItem(type, id);
        closeConfirmModal();
    };

    document.getElementById('confirmModal').classList.add('active');
    announceToScreenReader(`تأكيد حذف ${name}`);
}

// حذف عنصر

async function deleteItem(type, id) {
    let apiUrl = '';
    // This switch statement now includes 'user'
    switch (type) {
        case 'specialty':
            apiUrl = `/api/specialties/${id}`;
            break;
        case 'course':
            apiUrl = `/api/courses/${id}`;
            break;
        case 'video':
            apiUrl = `/api/videos/${id}`;
            break;
        case 'lecture':
            apiUrl = `/api/lectures/${id}`;
            break;
        case 'document':
            apiUrl = `/api/documents/${id}`;
            break;
        case 'user': // <-- ADDED THIS CASE
            apiUrl = `/api/users/${id}`;
            break;
        default:
            showAlert('error', 'نوع العنصر غير معروف للحذف.');
            return;
    }

    try {
        const response = await authFetch(apiUrl, { method: 'DELETE' });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `فشل في حذف العنصر`);
        }
        
        // Find the correct local array to update
        const dbArrayKey = (type === 'specialty') ? 'specialties' : `${type}s`;
        const targetDbArray = db[dbArrayKey];
        
        if (targetDbArray) {
            const index = targetDbArray.findIndex(item => item.id === id);
            if (index !== -1) {
                targetDbArray.splice(index, 1);
            }
        }
        
        // Re-render the corresponding table
        const renderMap = {
            specialty: renderSpecialties,
            course: renderCourses,
            video: renderVideos,
            lecture: renderLectures,
            document: renderDocuments,
            user: renderUsers // Also added user here
        };

        if (renderMap[type]) {
            renderMap[type]();
        }

        if (type === 'specialty') {
            updateAllUI();
        }

        updateStats();
        showAlert('success', 'تم حذف العنصر بنجاح.');

    } catch (err) {
        showAlert('error', `فشل في حذف العنصر: ${err.message}`);
        console.error(`Error deleting ${type}:`, err);
    }
}



// إغلاق نافذة التعديل
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    currentState.editItem = null;
    currentState.editType = null;
    document.getElementById('editModalBody').innerHTML = '';
    document.getElementById('editModalTitle').textContent = 'تعديل العنصر';
}

// إغلاق نافذة التأكيد
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    currentState.editItem = null;
    currentState.editType = null;
    document.getElementById('confirmActionBtn').onclick = null;
}

// عرض رسالة تنبيه
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.padding = '15px 25px';
    alertDiv.style.borderRadius = 'var(--border-radius)';
    alertDiv.style.boxShadow = 'var(--shadow)';
    alertDiv.style.zIndex = '1000';
    alertDiv.style.animation = 'fadeIn 0.3s ease';

    if (type === 'success') {
        alertDiv.style.backgroundColor = '#27ae60';
        alertDiv.style.color = 'white';
    } else {
        alertDiv.style.backgroundColor = '#e74c3c';
        alertDiv.style.color = 'white';
    }

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(alertDiv);
        }, 300);
    }, 3000);
}

// إعادة تعيين النموذج
function resetForm(formId) {
    document.getElementById(formId).reset();
}

// توليد معرف فريد (Only used if not using backend generated IDs)
function generateId() {
    return Math.floor(Math.random() * 1000000) + 1;
}

// تبديل لوحة التحكم
function toggleControlPanel() {
    const panel = document.getElementById('controlPanel');
    panel.classList.toggle('panel-collapsed');
    // Optionally, adjust main-content margin for responsiveness
    const mainContent = document.querySelector('.main-content');
    if (panel.classList.contains('panel-collapsed')) {
        mainContent.style.marginRight = '60px';
    } else {
        mainContent.style.marginRight = 'var(--panel-width)';
    }
}

// --- SIDEBAR TOGGLE LOGIC (RTL: always opens from the right) ---
function toggleSidebar() {
    const sidebar = document.getElementById('controlPanel') || document.querySelector('.control-panel');
    if (!sidebar) return;
    sidebar.classList.toggle('panel-collapsed');
    // Adjust main-content margin for responsiveness (RTL: marginRight only)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        if (sidebar.classList.contains('panel-collapsed')) {
            mainContent.style.marginRight = '0';
        } else {
            mainContent.style.marginRight = 'var(--panel-width)';
        }
        mainContent.style.marginLeft = '0'; // Always 0 for RTL
    }
}

// --- CONTROL PANEL FUNCTIONALITY ---
function changeTheme(theme, silent = false) {
    if (theme === 'default') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', theme);
    }
    currentState.currentTheme = theme;
    localStorage.setItem('theme', theme);
    // Update active button
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`changeTheme('${theme}')`)) {
            btn.classList.add('active');
        }
    });
    // Announce to screen reader
    if (!silent) announceToScreenReader('تم تغيير الثيم');
}

function adjustSize(value) {
    document.documentElement.style.setProperty('--text-size', value + 'rem');
    document.getElementById('sizeLabel').textContent = value == 1 ? 'عادي' : value;
    localStorage.setItem('textSize', value);
}

function adjustContentSize(value) {
    document.documentElement.style.setProperty('--content-scale', value);
    document.getElementById('contentSizeLabel').textContent = value == 1 ? 'عادي' : value;
    localStorage.setItem('contentSize', value);
}

window.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle button
    const menuBtn = document.getElementById('openSidebarBtn');
    if (menuBtn) menuBtn.onclick = toggleSidebar;
    // Close button inside sidebar
    const closeBtn = document.querySelector('.toggle-panel');
    if (closeBtn) closeBtn.onclick = toggleSidebar;
    // Start with sidebar collapsed
    const sidebar = document.getElementById('controlPanel') || document.querySelector('.control-panel');
    const mainContent = document.querySelector('.main-content');
    if (sidebar && !sidebar.classList.contains('panel-collapsed')) {
        sidebar.classList.add('panel-collapsed');
        if (mainContent) {
            mainContent.style.marginRight = '0';
            mainContent.style.marginLeft = '0';
        }
    }
    // Control panel event listeners
    const themeBtns = document.querySelectorAll('.control-btn[onclick^="changeTheme"]');
    themeBtns.forEach(btn => {
        btn.onclick = function() {
            const theme = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            changeTheme(theme);
        };
    });
    const sizeSlider = document.getElementById('sizeSlider');
    if (sizeSlider) sizeSlider.oninput = function() { adjustSize(this.value); };
    const contentSizeSlider = document.getElementById('contentSizeSlider');
    if (contentSizeSlider) contentSizeSlider.oninput = function() { adjustContentSize(this.value); };
});
