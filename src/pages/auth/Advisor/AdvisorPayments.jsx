import React, { useEffect } from "react";
import axios from "axios";

const AdvisorPayments = () => {
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(
          "https://advisor-seller-backend.vercel.app/api/auth/profile",
          { withCredentials: true } // if your API needs cookies/session
        );
        console.log("Profile Data:", response.data);
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []); // runs only on page reload/mount

  return <div>AdvisorPayments</div>;
};

export default AdvisorPayments;
