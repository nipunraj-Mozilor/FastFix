import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SignUp() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    navigate('/analyzer');
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

      {/* Right side - Signup Form */}
      <div className="w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-6">Create Account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
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
              Create Account
            </button>
          </form>
          <div className="mt-4 text-center">
            <p>Already have an account? <a href="#" onClick={() => navigate('/login')} className="text-blue-500">Log in</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp; 