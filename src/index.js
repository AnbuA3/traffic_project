import React from "react";
import ReactDOM from "react-dom";
import "./style.css";
import App from "./App";
import "semantic-ui-css/semantic.min.css";
import registerServiceWorker from "./register";

ReactDOM.render(<App />, document.getElementById("root"));

// Optional: enables caching/offline via service worker
registerServiceWorker();
