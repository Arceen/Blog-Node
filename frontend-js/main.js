import Chat from "./modules/chat";
import Search from "./modules/search";
import RegistrationForm from "./modules/registrationForm";

if (document.querySelector("#registration-form")) {
  new RegistrationForm();
} else {
  new Search();
}

if (document.querySelector("#chat-wrapper")) {
  new Chat();
}
