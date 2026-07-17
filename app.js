// Audiobook Player State
let bookData = null;
let currentChapterIdx = 0;
let currentPageNum = null; // Can be string like 'ii' or '5'
let currentParagraphIdx = 0; // Relative to the active page
let isPlaying = false;
let autoFlip = true;
let activeVoice = 'ngoc_linh'; // Can be 'ngoc_linh' or 'thai_son'

// DOM Elements
const audioPlayer = document.getElementById('audio-player');
const bookContentBox = document.getElementById('book-content-box');
const headerChapterTitle = document.getElementById('header-chapter-title');
const pageDisplay = document.getElementById('page-display');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnPrevPara = document.getElementById('btn-prev-para');
const btnNextPara = document.getElementById('btn-next-para');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const btnSpeed = document.getElementById('btn-speed');
const speedMenu = document.getElementById('speed-menu');
const btnAutoflip = document.getElementById('btn-autoflip');
const btnTheme = document.getElementById('btn-theme');
const btnSidebar = document.getElementById('btn-sidebar');
const appSidebar = document.getElementById('app-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const chaptersList = document.getElementById('chapters-list');
const progressBarBg = document.getElementById('progress-bar-bg');
const progressBarFill = document.getElementById('progress-bar-fill');
const currentTimeLabel = document.getElementById('current-time');
const btnFontDec = document.getElementById('btn-font-dec');
const btnFontInc = document.getElementById('btn-font-inc');
let currentFontScale = parseFloat(localStorage.getItem('readerFontScale') || '1.15');

// 1. Initialize Application & Fetch Book Data
document.addEventListener('DOMContentLoaded', () => {
  fetch('book.json')
    .then(response => {
      if (!response.ok) throw new Error('Could not load book metadata.');
      return response.json();
    })
    .then(data => {
      bookData = data;
      if (bookContentBox) {
        bookContentBox.style.fontSize = currentFontScale + 'rem';
      }
      buildSidebar();
      loadChapter(0); // Load Preface by default
      setupEventListeners();
    })
    .catch(error => {
      console.error(error);
      bookContentBox.innerHTML = `
        <div class="loading-state">
          <i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i>
          <p>Lỗi tải sách nói: Hãy chắc chắn bạn đã chạy tập lệnh tạo audio và tệp book.json tồn tại.</p>
        </div>
      `;
    });
});

// 2. Build Sidebar Navigation
function buildSidebar() {
  chaptersList.innerHTML = '';
  bookData.chapters.forEach((ch, idx) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = ch.title;
    btn.dataset.index = idx;
    btn.addEventListener('click', () => {
      loadChapter(idx);
      closeSidebar();
    });
    li.appendChild(btn);
    chaptersList.appendChild(li);
  });
}

// 3. Load Chapter
function loadChapter(chIdx) {
  currentChapterIdx = chIdx;
  const chapter = bookData.chapters[chIdx];
  headerChapterTitle.textContent = chapter.title;
  
  // Highlight active chapter in sidebar
  const buttons = chaptersList.querySelectorAll('button');
  buttons.forEach((btn, idx) => {
    if (idx === chIdx) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Extract pages in this chapter
  const pages = [...new Set(chapter.paragraphs.map(p => p.page))];
  
  // Load the first page of this chapter
  loadPage(pages[0]);
}

// Get paragraphs belonging to the active page in the active chapter
function getPageParagraphs() {
  const chapter = bookData.chapters[currentChapterIdx];
  return chapter.paragraphs.filter(p => p.page === currentPageNum);
}

// 4. Load Page Content
function loadPage(pageNum) {
  currentPageNum = pageNum;
  pageDisplay.textContent = `Trang ${pageNum}`;
  
  const pageParas = getPageParagraphs();
  
  // Clear and render paragraphs
  bookContentBox.innerHTML = '';
  pageParas.forEach((p, idx) => {
    const pEl = document.createElement('p');
    pEl.textContent = p.text;
    pEl.dataset.index = idx;
    
    // Style matches the DOCX manuscript mapping
    if (p.style === 'Manuscript Section Title') {
      pEl.classList.add('section-title');
    } else if (p.style === 'Manuscript Block Quote') {
      pEl.classList.add('block-quote');
    } else if (p.style === 'Manuscript Letter Salutation') {
      pEl.classList.add('letter-salutation');
    } else if (p.style === 'Manuscript End Mark') {
      pEl.classList.add('end-mark');
    }
    
    // Tap to jump and play
    pEl.addEventListener('click', () => {
      selectParagraph(idx, true);
    });
    
    bookContentBox.appendChild(pEl);
  });
  
  // Reset paragraph index to 0 for the new page
  currentParagraphIdx = 0;
  
  // Update Prev/Next page button states
  updatePageNavButtons();
  
  // Update selection visually
  selectParagraph(0, isPlaying);
}

function updatePageNavButtons() {
  const chapter = bookData.chapters[currentChapterIdx];
  const pages = [...new Set(chapter.paragraphs.map(p => p.page))];
  const pageIdx = pages.indexOf(currentPageNum);
  
  // Prev page state
  if (pageIdx === 0 && currentChapterIdx === 0) {
    btnPrevPage.disabled = true;
  } else {
    btnPrevPage.disabled = false;
  }
  
  // Next page state
  if (pageIdx === pages.length - 1 && currentChapterIdx === bookData.chapters.length - 1) {
    btnNextPage.disabled = true;
  } else {
    btnNextPage.disabled = false;
  }
}

// 5. Select and Highlight Paragraph
function selectParagraph(idx, shouldPlay = false) {
  const pageParas = getPageParagraphs();
  if (idx < 0 || idx >= pageParas.length) return;
  
  currentParagraphIdx = idx;
  const pData = pageParas[idx];
  
  // Update DOM highlights
  const pElements = bookContentBox.querySelectorAll('p');
  pElements.forEach((el, elIdx) => {
    if (elIdx === idx) {
      el.className = el.className.replace('inactive', '').trim();
      el.classList.add('active');
      
      // Auto-scroll paragraph to center of viewport on mobile
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      el.className = el.className.replace('active', '').trim();
      el.classList.add('inactive');
    }
  });
  
  // Setup Audio source
  const audioKey = activeVoice === 'ngoc_linh' ? 'audio_ngoc_linh' : 'audio_thai_son';
  const audioUrl = pData[audioKey];
  
  if (audioUrl) {
    const targetUrl = new URL(audioUrl, window.location.href).href;
    if (audioPlayer.src !== targetUrl) {
      audioPlayer.src = audioUrl;
      audioPlayer.load();
    }
    
    if (shouldPlay) {
      playAudio();
    }
  } else {
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
    isPlaying = false;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    btnPlayPause.classList.remove('active');
  }
}

// 6. Playback Control Functions
function playAudio() {
  if (!audioPlayer.src || audioPlayer.src === window.location.href) {
    selectParagraph(currentParagraphIdx, true);
    return;
  }
  
  audioPlayer.play().catch(err => {
    console.warn("Playback error:", err);
  });
}

function pauseAudio() {
  audioPlayer.pause();
}

function togglePlay() {
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

// 7. Navigation Flow: Auto-advance and Skip
function playNextParagraph() {
  const pageParas = getPageParagraphs();
  
  if (currentParagraphIdx < pageParas.length - 1) {
    // Standard skip within current page
    selectParagraph(currentParagraphIdx + 1, isPlaying);
  } else {
    // End of page reached! Check if we can turn page
    turnPageForward(isPlaying);
  }
}

function playPrevParagraph() {
  if (currentParagraphIdx > 0) {
    selectParagraph(currentParagraphIdx - 1, isPlaying);
  } else {
    // Beginning of page reached! Check if we can go to previous page
    turnPageBackward(isPlaying);
  }
}

function turnPageForward(shouldPlay = false) {
  const chapter = bookData.chapters[currentChapterIdx];
  const pages = [...new Set(chapter.paragraphs.map(p => p.page))];
  const pageIdx = pages.indexOf(currentPageNum);
  
  if (pageIdx < pages.length - 1) {
    // Go to next page of current chapter
    loadPage(pages[pageIdx + 1]);
    if (shouldPlay) playAudio();
  } else if (currentChapterIdx < bookData.chapters.length - 1) {
    // Go to next chapter
    loadChapter(currentChapterIdx + 1);
    if (shouldPlay) playAudio();
  } else {
    // Book finished!
    pauseAudio();
    alert("Cảm ơn bạn đã lắng nghe hết cuốn sách nhỏ này!");
  }
}

function turnPageBackward(shouldPlay = false) {
  const chapter = bookData.chapters[currentChapterIdx];
  const pages = [...new Set(chapter.paragraphs.map(p => p.page))];
  const pageIdx = pages.indexOf(currentPageNum);
  
  if (pageIdx > 0) {
    // Go to previous page of current chapter
    loadPage(pages[pageIdx - 1]);
    // Start at last paragraph of previous page
    selectParagraph(getPageParagraphs().length - 1, shouldPlay);
  } else if (currentChapterIdx > 0) {
    // Go to previous chapter
    const prevChapterIdx = currentChapterIdx - 1;
    const prevChapter = bookData.chapters[prevChapterIdx];
    const prevPages = [...new Set(prevChapter.paragraphs.map(p => p.page))];
    
    currentChapterIdx = prevChapterIdx;
    headerChapterTitle.textContent = prevChapter.title;
    
    // Load last page of previous chapter
    loadPage(prevPages[prevPages.length - 1]);
    // Start at last paragraph
    selectParagraph(getPageParagraphs().length - 1, shouldPlay);
  }
}

// 8. Event Listeners Config
function setupEventListeners() {
  // Play / Pause Click
  btnPlayPause.addEventListener('click', togglePlay);
  
  // Skip Buttons
  btnNextPara.addEventListener('click', playNextParagraph);
  btnPrevPara.addEventListener('click', playPrevParagraph);
  
  // Page Nav Buttons
  btnNextPage.addEventListener('click', () => turnPageForward(isPlaying));
  btnPrevPage.addEventListener('click', () => turnPageBackward(isPlaying));
  
  // Auto-flip Toggle
  btnAutoflip.addEventListener('click', () => {
    autoFlip = !autoFlip;
    btnAutoflip.classList.toggle('active', autoFlip);
    const label = document.getElementById('autoflip-label');
    if (label) {
      label.textContent = autoFlip ? 'Tự đọc: Bật' : 'Tự đọc: Tắt';
    }
    const icon = btnAutoflip.querySelector('i');
    if (icon) {
      icon.className = autoFlip ? 'fa-solid fa-circle-play' : 'fa-solid fa-circle-stop';
    }
    
    // Start reading immediately if toggled on and not currently playing
    if (autoFlip && !isPlaying) {
      playAudio();
    }
  });
  
  // Font Size Adjusters
  if (btnFontDec) {
    btnFontDec.addEventListener('click', () => {
      currentFontScale = Math.max(0.85, currentFontScale - 0.05);
      bookContentBox.style.fontSize = currentFontScale + 'rem';
      localStorage.setItem('readerFontScale', currentFontScale);
    });
  }
  if (btnFontInc) {
    btnFontInc.addEventListener('click', () => {
      currentFontScale = Math.min(1.65, currentFontScale + 0.05);
      bookContentBox.style.fontSize = currentFontScale + 'rem';
      localStorage.setItem('readerFontScale', currentFontScale);
    });
  }
  
  // Audio Player Progress and Completion
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('loadedmetadata', () => {
    durationTimeLabel.textContent = formatTime(audioPlayer.duration);
  });
  
  // Native HTML5 Audio event listeners to sync UI state robustly
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    btnPlayPause.classList.add('active');
  });
  
  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    btnPlayPause.classList.remove('active');
    
    // Reset voice sample buttons in sidebar
    document.querySelectorAll('.voice-sample-btn').forEach(b => {
      b.querySelector('i').className = 'fa-solid fa-play';
      b.classList.remove('playing');
    });
  });

  audioPlayer.addEventListener('ended', () => {
    if (autoFlip) {
      playNextParagraph();
    }
  });
  
  // Progress Bar Seek Interaction
  progressBarBg.addEventListener('click', (e) => {
    const rect = progressBarBg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercentage = clickX / width;
    
    if (audioPlayer.duration) {
      audioPlayer.currentTime = clickPercentage * audioPlayer.duration;
    }
  });
  
  // Speed Selector Popover Toggle
  btnSpeed.addEventListener('click', (e) => {
    e.stopPropagation();
    speedMenu.classList.toggle('active');
  });
  
  // Speed Menu Option Click
  speedMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      speedMenu.querySelector('button.active').classList.remove('active');
      btn.classList.add('active');
      
      const speed = parseFloat(btn.dataset.speed);
      audioPlayer.defaultPlaybackRate = speed;
      audioPlayer.playbackRate = speed;
      btnSpeed.textContent = btn.dataset.speed + 'x';
      
      speedMenu.classList.remove('active');
    });
  });
  
  // Close speed menu when clicking outside
  document.addEventListener('click', () => {
    speedMenu.classList.remove('active');
  });
  
  // Theme Toggle (Dark/Light)
  btnTheme.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = btnTheme.querySelector('i');
    if (document.body.classList.contains('light-theme')) {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  });
  
  // Sidebar Draw Open/Close
  btnSidebar.addEventListener('click', openSidebar);
  btnCloseSidebar.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  
  // Voice Sample Buttons Playback Handler
  const sampleBtns = document.querySelectorAll('.voice-sample-btn');
  sampleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const voiceId = btn.dataset.voice;
      const targetSrc = `sample_${voiceId}.mp3`;
      const absoluteTarget = new URL(targetSrc, window.location.href).href;
      
      // If already playing this, pause it
      if (audioPlayer.src === absoluteTarget && !audioPlayer.paused) {
        audioPlayer.pause();
        return;
      }
      
      // Reset active icons for all sample buttons
      sampleBtns.forEach(b => {
        b.querySelector('i').className = 'fa-solid fa-play';
        b.classList.remove('playing');
      });
      
      // Load the selected sample voice
      audioPlayer.src = targetSrc;
      audioPlayer.load();
      
      // Play and update UI
      audioPlayer.play()
        .then(() => {
          btn.querySelector('i').className = 'fa-solid fa-square-stop';
          btn.classList.add('playing');
        })
        .catch(err => {
          console.warn("Could not play sample:", err);
        });
    });
  });
  
  // Dynamic Voice Switching in Player
  const btnVoiceSwitch = document.getElementById('btn-voice-switch');
  const activeVoiceLabel = document.getElementById('active-voice-label');
  if (btnVoiceSwitch) {
    btnVoiceSwitch.addEventListener('click', () => {
      const wasPlaying = isPlaying;
      const savedTime = audioPlayer.currentTime;
      
      // Toggle state
      activeVoice = activeVoice === 'ngoc_linh' ? 'thai_son' : 'ngoc_linh';
      
      // Update UI button text
      if (activeVoiceLabel) {
        activeVoiceLabel.textContent = activeVoice === 'ngoc_linh' ? 'Ngọc Linh' : 'Thái Sơn';
      }
      
      // Swap source dynamically for the current paragraph
      const pageParas = getPageParagraphs();
      const pData = pageParas[currentParagraphIdx];
      if (pData) {
        const audioKey = activeVoice === 'ngoc_linh' ? 'audio_ngoc_linh' : 'audio_thai_son';
        const audioUrl = pData[audioKey];
        
        if (audioUrl) {
          audioPlayer.src = audioUrl;
          audioPlayer.load();
          
          const onMetadata = () => {
            audioPlayer.currentTime = savedTime;
            if (wasPlaying) {
              audioPlayer.play().catch(err => console.warn(err));
            }
            audioPlayer.removeEventListener('loadedmetadata', onMetadata);
          };
          audioPlayer.addEventListener('loadedmetadata', onMetadata);
        } else {
          console.warn("Giọng đọc này chưa được tạo cho đoạn này.");
          audioPlayer.removeAttribute('src');
          audioPlayer.load();
        }
      }
    });
  }
}

// 9. Utility Helpers
function openSidebar() {
  appSidebar.classList.add('active');
  sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  appSidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateProgressBar() {
  const current = audioPlayer.currentTime;
  const duration = audioPlayer.duration;
  if (!duration) return;
  
  const percentage = (current / duration) * 100;
  progressBarFill.style.width = `${percentage}%`;
  currentTimeLabel.textContent = formatTime(current);
}
