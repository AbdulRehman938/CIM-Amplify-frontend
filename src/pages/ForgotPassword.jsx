import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, Toaster } from 'react-hot-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [timer, setTimer] = useState(0);

  const navigate = useNavigate();

  // Email validation
  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return 'Email is required';
    if (!regex.test(value)) return 'Please enter a valid email address';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validateEmail(email);
    setEmailError(validation);
    if (validation) return;

    setLoading(true);

    try {
      // Step 1: Check if email exists and is verified
      const profileRes = await axios.get('https://advisor-seller-backend.vercel.app/api/auth/profile', {
        validateStatus: () => true,
      });

      const profile = profileRes.data;

      if (!profile || profile.email !== email) {
        toast.error('Email does not exist ❌');
        return;
      }

      if (!profile.isEmailVerified) {
        toast.error('Email is not verified ❌');
        return;
      }

      // Step 2: Send reset password link
      const res = await axios.post(
        'https://advisor-seller-backend.vercel.app//api/auth/forgot-password',
        { email },
        { validateStatus: () => true }
      );

      if (res.status === 200) {
        toast.success('Reset link sent to your email ✅');

        // Start 5-minute cooldown
        setDisabled(true);
        setTimer(5 * 60);

        const countdown = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(countdown);
              setDisabled(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(res.data?.message || 'Something went wrong ❌');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-primary to-primary-50 px-4">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center gap-6">
        <h2 className="text-3xl font-bold text-center text-black">Forgot Password</h2>
        <p className="text-center text-gray-600">
          Enter your email to receive a reset password link.
        </p>

        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || disabled}
            className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-primary ${emailError ? 'border-red-500' : 'border-primary'}`}
          />
          {emailError && <span className="text-red-500 text-sm">{emailError}</span>}

          <button
            type="submit"
            disabled={loading || disabled}
            className={`w-full py-3 mt-2 rounded-xl text-white font-semibold ${
              loading || disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary/70 hover:bg-primary'
            }`}
          >
            {loading
              ? 'Checking...'
              : disabled
              ? `Wait ${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`
              : 'Send Reset Link'}
          </button>
        </form>

        <span
          className="text-primary hover:text-primary-800 cursor-pointer mt-4"
          onClick={() => navigate('/auth')}
        >
          Back to Login
        </span>
      </div>
    </div>
  );
};

export default ForgotPassword;
