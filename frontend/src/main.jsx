import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "bootstrap/dist/css/bootstrap.min.css";

createRoot(document.getElementById("root")).render(
<<<<<<< Updated upstream
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
=======
  <BrowserRouter>
    <Auth0Provider
      domain="dev-6qyiyqksmtwrjpbi.us.auth0.com"
      clientId="4HDfA91gN7LlZJDZ6vTyt9CfEbuUZUWH"
      authorizationParams={{ redirect_uri: window.location.origin }}
    >
        <App />
    </Auth0Provider>
  </BrowserRouter>
>>>>>>> Stashed changes
);