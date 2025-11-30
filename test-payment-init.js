// Quick test script to verify payment initialization
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const FLW_BASE_URL = process.env.FLW_BASE_URL;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;

console.log('=== Testing Flutterwave Payment Initialization ===\n');
console.log('FLW_BASE_URL:', FLW_BASE_URL);
console.log('FLW_SECRET_KEY:', FLW_SECRET_KEY ? FLW_SECRET_KEY.substring(0, 20) + '...' : 'MISSING');
console.log('');

if (!FLW_SECRET_KEY || !FLW_BASE_URL) {
  console.error('❌ Missing Flutterwave configuration!');
  process.exit(1);
}

const testPayload = {
  tx_ref: `TEST-${Date.now()}`,
  amount: 100,
  currency: "NGN",
  redirect_url: "https://flutterwave.com/ng/",
  customer: {
    email: "test@example.com",
    phonenumber: "08012345678",
  },
  customizations: {
    title: "JJB24 Deposit Test",
    description: "Wallet funding via Flutterwave",
  },
};

console.log('Sending test request to Flutterwave...\n');

try {
  const response = await axios.post(`${FLW_BASE_URL}/payments`, testPayload, {
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  console.log('✅ SUCCESS!');
  console.log('Status:', response.status);
  console.log('Response Status:', response.data.status);
  console.log('Message:', response.data.message);
  
  if (response.data.data && response.data.data.link) {
    console.log('\n✅ Payment link generated:');
    console.log(response.data.data.link);
  } else {
    console.log('\n⚠️  No payment link in response');
    console.log('Full response:', JSON.stringify(response.data, null, 2));
  }
} catch (error) {
  console.error('\n❌ ERROR:');
  console.error('Status:', error.response?.status);
  console.error('Message:', error.message);
  
  if (error.response?.data) {
    console.error('\nFlutterwave Error Response:');
    console.error(JSON.stringify(error.response.data, null, 2));
  }
  
  if (error.response?.status === 401) {
    console.error('\n💡 This is an authentication error. Check your FLW_SECRET_KEY.');
  } else if (error.response?.status === 400) {
    console.error('\n💡 This is a bad request error. Check the payload structure.');
  }
  
  process.exit(1);
}


