import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/login', {
        username: formData.email,
        password: formData.password,
      });
      if (response.status === 200) {
        console.log('Login successful');
        navigate('/analyzer'); // Navigate to the analyzer page
      }
    } catch (error) {
      console.log('Invalid credentials');
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left side - Branding and Info */}
      <div className="w-1/2 bg-blue-500 flex flex-col justify-center items-center text-white p-8">
        <h1 className="text-4xl font-bold mb-4">fas<span className="text-black">fix</span></h1>
        <h2 className="text-2xl font-bold mb-2">SPEEDUP YOUR SITE, REAL FAST</h2>
        <p className="mb-8">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis cursus gravida ac.</p>
        <div className="flex space-x-4">
          <a href="#"><i className="fab fa-github text-2xl"></i></a>
          <a href="#"><i className="fab fa-twitter text-2xl"></i></a>
          <a href="#"><i className="fab fa-linkedin text-2xl"></i></a>
          <a href="#"><i className="fab fa-discord text-2xl"></i></a>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-6">Log In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600"
            >
              Log In
            </button>
          </form>
          <div className="mt-4 text-center">
            <p>
              Don't have an Account?{' '}
              <a
                href="#"
                onClick={() => navigate('/signup')}
                className="text-blue-500 hover:underline"
              >
                Sign Up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;