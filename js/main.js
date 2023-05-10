"use strict";

const navToggle = document.querySelector("#navToggle");
const nav = document.querySelector("#nav");

navToggle.addEventListener("click", function (event) {
  event.preventDefault();
  nav.classList.toggle("show");
});

const yearElement = document.querySelector("#year");

setInterval(function () {
  yearElement.textContent = new Date().getFullYear();
}, 1000);
