# JJJPay Payment SDK

A JavaScript SDK for integrating payment checkout functionality into web applications.

## Installation

```bash
npm install jjjpay-payment-sdk
```

## Usage

### Browser (UMD)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Payment Example</title>
</head>
<body>
  <button id="payButton">Pay Now</button>

  <script src="https://unpkg.com/jjjpay-payment-sdk/dist/payment-sdk.js"></script>
  <script>
    document.getElementById('payButton').addEventListener('click', function() {
      const checkout = new PaymentCheckout({
        orderId: '3812177499825986513',
        orderApiUrl: '/api/order',
        qrApiUrl: '/api/qr',
        apiBaseUrl:'http://localhost:3000' //optional
        address:'0x88ed523ef98efaa8643941fd2e1f82aa80ad0ffb',
        callback: function(data) {
          console.log('Payment successful:', data);
          // Handle successful payment
        },
        onclose: function() {
          console.log('Payment modal closed');
          // Handle modal close
        }
      });

      checkout.open();
    });
  </script>
</body>
</html>
```

### ES6 Modules

```javascript
import PaymentCheckout from 'jjjpay-payment-sdk';

const checkout = new PaymentCheckout({
  orderId: '3812177499825986513',
  orderApiUrl: '/api/order',
  qrApiUrl: '/api/qr',
  apiBaseUrl:'http://localhost:3000' //optional
  address:'0x88ed523ef98efaa8643941fd2e1f82aa80ad0ffb',
  callback: (data) => {
    console.log('Payment successful:', data);
  },
  onclose: () => {
    console.log('Payment modal closed');
  }
});

checkout.open();
```

## API Reference

### PaymentCheckout

#### Constructor Options

- `orderId` (string, required): Unique order identifier
- `orderApiUrl`(string, required): The URL of the API that connects your own backend with Ainepay's API at /api/order/ 
- `address` (string, required): The receiving wallet address where users should send payment.
- `qrApiUrl` (string,required): API endpoint used to generate the payment QR code from the address.
- `apiBaseUrl` (string,optional): Base URL / root domain for all API requests (e.g., `https://api.yourdomain.com`).  
  If provided, `orderApiUrl` can be a relative path.
- `callback` (function, required): Callback function called on successful payment
- `onclose` (function, optional): Callback function called when modal is closed

#### Methods

- `open()`: Opens the payment checkout modal
- `close()`: Closes the payment checkout modal

## Development

```bash
# Install dependencies
npm install

# Start development build with watch mode
npm run dev

# Build for production
npm run build
```

## License

MIT
ayment-sdk npm for test
