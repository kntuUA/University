$(function () {
  let navToggle = $('#navToggle');
  let nav = $('#nav');

  navToggle.on('click', function (event) {
    event.preventDefault();

    nav.toggleClass('show');
  });
});

const yearElement = document.querySelector('.year');
const currentYear = new Date().getFullYear();
const year = (yearElement.textContent = currentYear);
