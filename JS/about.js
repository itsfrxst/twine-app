const astroBtn = document.getElementById('astroTab');
const favesBtn = document.getElementById('favesTab');
const skillsBtn = document.getElementById('skillsTab');
const interestsBtn = document.getElementById('interestsTab');
const bioBtn = document.getElementById('bioTab');

const astroModal = document.getElementById('astrology');
const favesModal = document.getElementById('favorites');
const skillsModal = document.getElementById('skills');
const interestsModal = document.getElementById('interests');
const bioModal = document.getElementById('bio');


astroBtn.addEventListener('click', () => {
    astroModal.style.visibility = "visible";
    favesModal.style.visibility = "hidden";
    skillsModal.style.visibility = "hidden";
    interestsModal.style.visibility = "hidden";
    bioModal.style.visibility = "hidden";
});

favesBtn.addEventListener('click', () => {
    astroModal.style.visibility = "hidden";
    favesModal.style.visibility = "visible";
    skillsModal.style.visibility = "hidden";
    interestsModal.style.visibility = "hidden";
    bioModal.style.visibility = "hidden";
});

skillsBtn.addEventListener('click', () => {
    astroModal.style.visibility = "hidden";
    favesModal.style.visibility = "hidden";
    skillsModal.style.visibility = "visible";
    interestsModal.style.visibility = "hidden";
    bioModal.style.visibility = "hidden";
});

interestsBtn.addEventListener('click', () => {
    astroModal.style.visibility = "hidden";
    favesModal.style.visibility = "hidden";
    skillsModal.style.visibility = "hidden";
    interestsModal.style.visibility = "visible";
    bioModal.style.visibility = "hidden";
});

bioBtn.addEventListener('click', () => {
    astroModal.style.visibility = "hidden";
    favesModal.style.visibility = "hidden";
    skillsModal.style.visibility = "hidden";
    interestsModal.style.visibility = "hidden";
    bioModal.style.visibility = "visible";
});