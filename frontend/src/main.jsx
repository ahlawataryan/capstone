import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "bootstrap/dist/css/bootstrap.min.css";
/*
Defines components used in the project
Mainly used for auth0.
Technically this is the main file by running the App component,
but App.jsx contains all the base information
Not entirely sure how this works since I can't use the env variables, but this is all publicly accessible anyways
*/
createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain="dev-6qyiyqksmtwrjpbi.us.auth0.com"
    clientId="4HDfA91gN7LlZJDZ6vTyt9CfEbuUZUWH"
    authorizationParams={{
      redirect_uri: window.location.origin,
    }}
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Auth0Provider>
);