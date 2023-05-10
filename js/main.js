"use strict";

const navToggle = document.querySelector("#navToggle");
const nav = document.querySelector("#nav");
const yearElement = document.querySelector("#year");

navToggle.addEventListener("click", toggleNav);

function toggleNav(event) {
  event.preventDefault();
  nav.classList.toggle("show");
}

function updateYear() {
  yearElement.textContent = new Date().getFullYear();
}

updateYear();
