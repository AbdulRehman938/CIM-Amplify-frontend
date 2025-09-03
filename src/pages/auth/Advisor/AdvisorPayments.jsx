import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, Toaster } from "react-hot-toast";
import {
  FaCreditCard,
  FaLock,
  FaUser,
  FaGlobe,
  FaMapMarkerAlt,
  FaGift,
  FaCalendarAlt,
  FaCcVisa,
  FaCcMastercard,
  FaCcAmex,
  FaCcDiscover,
} from "react-icons/fa";

// ✅ Validation schema
const PaymentSchema = Yup.object().shape({
  firstName: Yup.string()
    .matches(/^[A-Za-z]+$/, "Only alphabets allowed")
    .min(2, "Too short")
    .max(20, "Too long")
    .required("First name is required"),

  lastName: Yup.string()
    .matches(/^[A-Za-z]+$/, "Only alphabets allowed")
    .min(2, "Too short")
    .max(20, "Too long")
    .required("Last name is required"),

  cardNumber: Yup.string()
    .transform((value) => value.replace(/\s/g, ""))
    .matches(/^[0-9]{16}$/, "Card number must be 16 digits")
    .required("Card number is required"),

  expiry: Yup.string()
    .matches(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiration must be in MM/YY format")
    .required("Expiration date is required"),

  cvv: Yup.string()
    .matches(/^[0-9]{3,4}$/, "CVV must be 3 or 4 digits")
    .required("Security code is required"),

  country: Yup.string().required("Country is required"),

  postalCode: Yup.string()
    .matches(/^[0-9]{4,10}$/, "Invalid postal code")
    .required("Postal code is required"),

  coupon: Yup.string()
    .matches(/^[A-Za-z0-9]*$/, "Only letters & numbers allowed")
    .notRequired(),
});

// ✅ Auto-format helpers
const formatCardNumber = (value) => {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatExpiry = (value) => {
  return value
    .replace(/\D/g, "")
    .slice(0, 4)
    .replace(/(\d{2})(\d{1,2})?/, (match, m, y) => (y ? `${m}/${y}` : m));
};

const formatCVV = (value) => value.replace(/\D/g, "").slice(0, 4);
const [paymentMethodId, setPaymentMethodId] = useState(null);


// normalize to standard format
const normalizeIntentId = (id) => {
  if (!id) return null;
  // Stripe intent IDs are always "pi_" + 16 chars
  const match = id.match(/^pi_[A-Za-z0-9]{16}/);
  return match ? match[0] : id;
};

const AdvisorPayments = () => {
  const [amount, setAmount] = useState(5000);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [couponApplied, setCouponApplied] = useState(false);

  const handleApplyCoupon = async (coupon) => {
    try {
      const token = localStorage.getItem("access_token");
      const payload = coupon && coupon.trim() !== "" ? { couponCode: coupon.trim() } : {};
      const response = await fetch(
        "https://advisor-seller-backend.vercel.app/api/payment/create-intent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
        }
      );

      const data = await response.json();
      console.log("Coupon Response:", data);

      if ((response.status === 200 || response.status === 201) && data.amount !== undefined) {
        setAmount(data.amount);
        let intentId = null;
        if (data.clientSecret) {
          const extractedId = data.clientSecret.split("_secret")[0];
          intentId = normalizeIntentId(extractedId);
        } else if (data.paymentIntentId) {
          intentId = normalizeIntentId(data.paymentIntentId);
        }
        if (intentId) setPaymentIntentId(intentId);
        setCouponApplied(true);
        toast.success(`Coupon applied! New amount: $${data.amount}`);
      } else {
        toast.error("Failed to apply coupon ❌");
      }
    } catch (error) {
      console.error("Apply coupon error:", error);
      toast.error("Error applying coupon ❌");
    }
  };

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-gray-100 p-6">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            minWidth: "400px",
            maxWidth: "600px",
          },
        }}
      />
      <div className="w-full max-w-lg bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Advisor Payments</h1>

        <Formik
          initialValues={{
            firstName: "",
            lastName: "",
            cardNumber: "",
            expiry: "",
            cvv: "",
            country: "",
            postalCode: "",
            coupon: "",
          }}
          validationSchema={PaymentSchema}
          onSubmit={async (values, { setSubmitting, resetForm }) => {
            let intentId = paymentIntentId;

            // 1️⃣ If no intent exists yet, create it
            if (!intentId) {
              try {
                const token = localStorage.getItem("access_token");
                const response = await fetch(
                  "https://advisor-seller-backend.vercel.app/api/payment/create-intent",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: undefined, // no coupon applied
                  }
                );
                const data = await response.json();

                // Use full paymentIntentId from backend
                if (data.paymentIntentId) {
                  intentId = data.paymentIntentId;
                  setPaymentIntentId(intentId);
                  setAmount(data.amount || 5000);
                } else if (data.clientSecret) {
                  // fallback if backend returns clientSecret
                  intentId = data.clientSecret.split("_secret")[0];
                  setPaymentIntentId(intentId);
                  setAmount(data.amount || 5000);
                } else {
                  toast.error("Failed to create payment intent ❌");
                  setSubmitting(false);
                  return;
                }
              } catch (error) {
                console.error("Create intent error:", error);
                toast.error("Failed to create payment intent ❌");
                setSubmitting(false);
                return;
              }
            }

            // 1️⃣ Create PaymentMethod from card details
            try {
              const token = localStorage.getItem("access_token");
              const paymentMethodResponse = await fetch(
                "https://advisor-seller-backend.vercel.app/api/payment/create-method",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    cardNumber: values.cardNumber.replace(/\s/g, ""),
                    expiry: values.expiry,
                    cvv: values.cvv,
                    country: values.country,
                    postalCode: values.postalCode,
                  }),
                }
              );
              const pmData = await paymentMethodResponse.json();
              if (!pmData.paymentMethodId) {
                toast.error("Failed to create payment method ❌");
                setSubmitting(false);
                return;
              }
              setPaymentMethodId(pmData.paymentMethodId);
            } catch (err) {
              console.error("Create PaymentMethod error:", err);
              toast.error("Failed to create payment method ❌");
              setSubmitting(false);
              return;
            }

            // 2️⃣ Confirm payment
            try {
              const token = localStorage.getItem("access_token");

              // ⚡ Use paymentMethodId from the response of create-method step
              // Ensure we are sending Stripe-style IDs
              const paymentMethodIdToUse = pmData.paymentMethodId; // must be valid Stripe ID
              const paymentIntentIdToUse = intentId; // must be valid Stripe ID

              const payload = {
                paymentIntentId: paymentIntentIdToUse,
                paymentMethodId: paymentMethodIdToUse,
              };

              const response = await fetch(
                "https://advisor-seller-backend.vercel.app/api/payment/confirm",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                }
              );

              const data = await response.json();
              console.log("Confirm Response:", data);

              if (response.ok) {
                toast.success("Payment confirmed 🎉");
                resetForm();
                setAmount(5000);
                setPaymentIntentId(null);
                setCouponApplied(false);
              } else {
                toast.error(data.message || "Payment failed ❌");
              }
            } catch (error) {
              console.error("Confirm error:", error);
              toast.error("Payment failed ❌");
            } finally {
              setSubmitting(false);
            }



          }}

        >
          {({ values, setFieldValue, isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              {/* First Name */}
              <div>
                <div className="flex items-center border rounded-lg px-3 py-2">
                  <FaUser className="text-gray-500 mr-2" />
                  <Field
                    name="firstName"
                    placeholder="John"
                    className="w-full outline-none"
                  />
                </div>
                <ErrorMessage
                  name="firstName"
                  component="p"
                  className="text-red-500 text-sm"
                />
              </div>

              {/* Last Name */}
              <div>
                <div className="flex items-center border rounded-lg px-3 py-2">
                  <FaUser className="text-gray-500 mr-2" />
                  <Field
                    name="lastName"
                    placeholder="Doe"
                    className="w-full outline-none"
                  />
                </div>
                <ErrorMessage
                  name="lastName"
                  component="p"
                  className="text-red-500 text-sm"
                />
              </div>

              {/* Card Number */}
              <div>
                <div className="flex items-center border rounded-lg px-3 py-2">
                  {/* Detect card type */}
                  {values.cardNumber.startsWith("4") ? (
                    <FaCcVisa className="text-blue-600 mr-2" />
                  ) : values.cardNumber.startsWith("5") ? (
                    <FaCcMastercard className="text-red-600 mr-2" />
                  ) : values.cardNumber.startsWith("3") ? (
                    <FaCcAmex className="text-green-600 mr-2" />
                  ) : values.cardNumber.startsWith("6") ? (
                    <FaCcDiscover className="text-orange-600 mr-2" />
                  ) : (
                    <FaCreditCard className="text-gray-500 mr-2" />
                  )}

                  <Field
                    name="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={values.cardNumber}
                    onChange={(e) =>
                      setFieldValue(
                        "cardNumber",
                        formatCardNumber(e.target.value)
                      )
                    }
                    className="w-full outline-none"
                  />
                </div>
                <ErrorMessage
                  name="cardNumber"
                  component="p"
                  className="text-red-500 text-sm"
                />
              </div>

              {/* Expiry + CVV */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center border rounded-lg px-3 py-2">
                    <FaCalendarAlt className="text-gray-500 mr-2" />
                    <Field
                      name="expiry"
                      placeholder="MM/YY"
                      value={values.expiry}
                      onChange={(e) =>
                        setFieldValue("expiry", formatExpiry(e.target.value))
                      }
                      className="w-full outline-none"
                    />
                  </div>
                  <ErrorMessage
                    name="expiry"
                    component="p"
                    className="text-red-500 text-sm"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center border rounded-lg px-3 py-2">
                    <FaLock className="text-gray-500 mr-2" />
                    <Field
                      name="cvv"
                      placeholder="123"
                      value={values.cvv}
                      onChange={(e) =>
                        setFieldValue("cvv", formatCVV(e.target.value))
                      }
                      className="w-full outline-none"
                    />
                  </div>
                  <ErrorMessage
                    name="cvv"
                    component="p"
                    className="text-red-500 text-sm"
                  />
                </div>
              </div>

              {/* Country */}
              <div>
                <div className="flex items-center border rounded-lg px-3 py-2">
                  <FaGlobe className="text-gray-500 mr-2" />
                  <Field as="select" name="country" className="w-full outline-none">
                    <option value="">Select country*</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="USA">USA</option>
                    <option value="UK">UK</option>
                  </Field>
                </div>
                <ErrorMessage
                  name="country"
                  component="p"
                  className="text-red-500 text-sm"
                />
              </div>

              {/* Postal Code */}
              <div>
                <div className="flex items-center border rounded-lg px-3 py-2">
                  <FaMapMarkerAlt className="text-gray-500 mr-2" />
                  <Field
                    name="postalCode"
                    placeholder="12345"
                    className="w-full outline-none"
                  />
                </div>
                <ErrorMessage
                  name="postalCode"
                  component="p"
                  className="text-red-500 text-sm"
                />
              </div>

              {/* Coupon Code + Apply */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border rounded-lg px-3 py-2">
                  <FaGift className="text-gray-500 mr-2" />
                  <Field
                    name="coupon"
                    placeholder="DISCOUNT50"
                    className="w-full outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyCoupon(values.coupon)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Apply
                </button>
              </div>
              <ErrorMessage
                name="coupon"
                component="p"
                className="text-red-500 text-sm"
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {isSubmitting ? "Processing..." : `Pay $${amount}`}
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default AdvisorPayments;
