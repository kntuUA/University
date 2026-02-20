document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. АВТОМАТИЧНИЙ РІК У ФУТЕРІ
  // ==========================================
  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // ==========================================
  // 2. МОБІЛЬНЕ МЕНЮ (БУРГЕР)
  // ==========================================
  const burgerBtn = document.getElementById('burgerToggle');
  const navMenu = document.getElementById('navMenu');

  if (burgerBtn && navMenu) {
    burgerBtn.addEventListener('click', () => {
      // Показуємо або ховаємо меню
      navMenu.classList.toggle('active');
      
      // Анімація самої кнопки (бургер перетворюється на хрестик)
      burgerBtn.classList.toggle('toggle');
    });
  }

  // ==========================================
  // 3. ПІДСВІЧУВАННЯ АКТИВНОГО ПУНКТУ МЕНЮ
  // ==========================================
  const navLinks = document.querySelectorAll('.nav__link');

  navLinks.forEach(link => {
    // Спочатку очищаємо всі пункти від активного класу
    link.classList.remove('active'); 

    // Оскільки весь наш локальний сайт - це розділ "Абітурієнту",
    // ми просто знаходимо цей текст і завжди робимо його підсвіченим.
    if (link.textContent.trim() === 'Абітурієнту') {
      link.classList.add('active');
    }
  });

  // ==========================================
  // 4. ТЕМНА / СВІТЛА ТЕМА (DARK MODE)
  // ==========================================
  const themeToggle = document.getElementById('themeToggle');
  
  if (themeToggle) {
    const themeIcon = themeToggle.querySelector('i');

    // 1. Перевіряємо, чи є збережена тема в пам'яті браузера (localStorage)
    const savedTheme = localStorage.getItem('site-theme');
    
    // Якщо збережена темна тема, вмикаємо її одразу при завантаженні
    if (savedTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun'); // Міняємо місяць на сонце
    }

    // 2. Логіка перемикання по кліку
    themeToggle.addEventListener('click', () => {
      // Перевіряємо, яка тема зараз активна
      if (document.body.getAttribute('data-theme') === 'dark') {
        // Вимикаємо темну
        document.body.removeAttribute('data-theme');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('site-theme', 'light'); // Зберігаємо світлу
      } else {
        // Вмикаємо темну
        document.body.setAttribute('data-theme', 'dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('site-theme', 'dark'); // Зберігаємо темну
      }
    });
  }

  // ==========================================
  // 5. ЗАКРИТТЯ БАНЕРА "НЕАКТУАЛЬНО"
  // ==========================================
  const banner = document.getElementById('outdatedBanner');
  const closeBannerBtn = document.getElementById('closeBanner');

  if (banner && closeBannerBtn) {
    // Перевіряємо, чи користувач вже закривав банер у цій сесії
    if (sessionStorage.getItem('bannerClosed') === 'true') {
      banner.style.display = 'none';
    }

    // Закриваємо банер по кліку на хрестик
    closeBannerBtn.addEventListener('click', () => {
      banner.style.display = 'none';
      sessionStorage.setItem('bannerClosed', 'true');
    });
  }

});

// === КОМПОНЕНТ ШАПКИ (HEADER) ===
class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="header">
        <div class="outdated-banner" id="outdatedBanner">
          ⚠️ <strong>Увага:</strong> Інформація на цьому сайті, на жаль, вже не актуальна :) Перевіряйте деталі на <a href="https://www.kntu.kr.ua/" target="_blank">офіційному сайті ЦНТУ</a>.
          <button class="outdated-banner__close" id="closeBanner" aria-label="Закрити">&times;</button>
        </div>

        <div class="container header__container">
          <a href="https://kntuua.github.io/University/" class="logo">
            <img src="img/Gerb.webp" alt="Логотип ЦНТУ" class="logo__img">
            <div class="logo__text">ЦНТУ</div>
          </a>

          <nav class="nav" id="navMenu">
            <a href="https://kntu.kr.ua/" class="nav__link">Університет</a>
            <a href="https://kntu.kr.ua/" class="nav__link">Абітурієнту</a>
            <a href="https://kntu.kr.ua/" class="nav__link">Факультети</a>
            <a href="https://kntu.kr.ua/" class="nav__link">Наука</a>
            <a href="https://kntu.kr.ua/" class="nav__link">Студенту</a>
          </nav>

          <div class="header__actions">
            <button class="theme-toggle" id="themeToggle" aria-label="Перемкнути тему">
              <i class="fas fa-moon"></i>
            </button>
            
            <button class="burger" id="burgerToggle" aria-label="Відкрити меню">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>
    `;
  }
}

// === КОМПОНЕНТ ФУТЕРА (FOOTER) ===
class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="footer">
        <div class="container footer__container">
          <div class="footer__brand">
            <h2 class="footer__logo-text">ЦНТУ</h2>
            <p class="footer__text mt-10">Твій простір для розвитку та інновацій.</p>
            <div class="socials mt-20">
              <a href="https://www.facebook.com/CNTU.kr.ua/?ref=bookmarks" aria-label="Facebook"><i class="fab fa-facebook"></i></a>
              <a href="https://x.com/CNTU1929" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
              <a href="https://www.youtube.com/@universitycntu/featured" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
              <a href="https://www.instagram.com/cntu.kr.ua/" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            </div>
          </div>

          <div class="footer__col">
            <h3 class="footer__title">Контакти комісії</h3>
            <ul class="footer__list">
              <li><i class="fas fa-phone-alt"></i> (095) 078-59-00</li>
              <li><i class="fas fa-phone-alt"></i> (0522) 55-93-13</li>
              <li><i class="fas fa-clock"></i> Пн-Пт: 08:00 - 17:00</li>
            </ul>
          </div>

          <div class="footer__col">
            <h3 class="footer__title">Центр підготовки</h3>
            <ul class="footer__list">
              <li><i class="fas fa-phone-alt"></i> (095) 086-24-57</li>
              <li><i class="fas fa-phone-alt"></i> (0522) 55-50-18</li>
            </ul>
          </div>
        </div>
        
        <div class="footer__bottom">
          <div class="container">
            <p>© <span id="currentYear"></span> ЦНТУ. Всі права захищено. Використання матеріалів сайту можливе тільки з посиланням на джерело.</p>
          </div>
        </div>
      </footer>
    `;
  }
}

// Реєструємо наші нові теги в браузері
customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);