//1. Thư viện nền tảng React
import React from 'react'
import ReactDOM from 'react-dom/client'//Cầu nối giúp liên kết react với DOM( cây của html)
//2. Component nội bộ của dự án
import App from './App.jsx'
// 3. Tệp định dạng giao diện
import './index.css'


//createRoot() :hàm tạo một vùng để React quản lý giao diện bên trong HTML
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
