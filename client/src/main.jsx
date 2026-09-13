import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import './index.css';

const path = window.location.pathname;
const RootComponent = path.startsWith('/admin') ? AdminApp : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);
