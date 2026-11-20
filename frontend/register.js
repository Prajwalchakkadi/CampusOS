
const form = document.getElementById("registrationForm");
const message = document.getElementById("message");

form.addEventListener("submit", function(event) {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const phone = form.elements["phone"].value;

  if (!/^[0-9]{10}$/.test(phone)) {
    message.style.color = "red";
    message.textContent = "Enter a valid 10-digit phone number.";
    return;
  }

  const dob = new Date(form.elements["dob"].value);
  const today = new Date();

  if (dob >= today) {
    message.style.color = "red";
    message.textContent = "Please enter a valid date of birth.";
    return;
  }

  message.style.color = "#1763ad";
  message.textContent =
    "Form validated! Backend registration and admin approval are the next steps.";
});

