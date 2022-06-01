$(function() {

let navToggle = $("#navToggle");
let nav = $("#nav");

navToggle.on("click", function(event) {
		event.preventDefault();

		nav.toggleClass("show")
	});

});

