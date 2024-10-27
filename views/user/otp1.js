if (paymentMethod === 'razorpay') {
    fetch("/order/create_razor_order", {
        method: "post",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            paymentMethod: paymentMethod,
            orderData: orderData
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status) {
            var option = {
                key: "rzp_test_0cBu6RNEEzVgUn", // Replace with your Razorpay key
                amount: data.data.payableAmount * 100, // Convert amount to paisa
                currency: "INR",
                name: "Trovup",
                description: "Payment for order",
                order_id: data.data.razorpayOrder.id,
                handler: function (response) {
                    fetch("/order/verify_razorpay_payment", {
                        method: "post",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            orderData: orderData,
                            payment_id: response.razorpay_payment_id,
                            order_id: response.razorpay_order_id,
                            signature: response.razorpay_signature
                        }),
                    })
                    .then((response) => response.json())
                    .then((verifyData) => {
                        if (verifyData.status) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Order Placed',
                                text: 'Your order has been placed successfully.',
                                confirmButtonText: 'OK',
                                timer: 2000,
                                willClose: () => {
                                    window.location = "/";
                                }
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: "Payment Failed",
                                text: 'Payment verification failed. Please try again.',
                                confirmButtonText: 'OK'
                            });
                        }
                    });
                },
                prefill: {
                    name: 'User Name', // Prefill user name
                    email: 'useremail@email.com', // Prefill user email
                    contact: '9876543210' // Prefill user contact
                },
                theme: {
                    color: "#3399cc"
                }
            };
            var paymentObject = new window.Razorpay(option);
            paymentObject.on('payment.failed', function (response) {
                fetch("/order/verify_razorpay_payment", {
                    method: "post",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        orderData: orderData,
                        payment_id: response.error.metadata.payment_id,
                        order_id: response.error.metadata.order_id,
                        signature: response.error.metadata.signature
                    }),
                })
                .then((res) => res.json())
                .then((failedData) => {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Payment Failed',
                        text: 'The payment was not completed. Redirecting to order details...',
                        confirmButtonText: 'OK',
                        timer: 3000,
                        willClose: () => {
                            if (failedData.response) {
                                window.location = failedData.response;
                            } else {
                                window.location = "/";
                            }
                        }
                    });
                });
            });
            paymentObject.open();
        } else {
            Swal.fire({
                icon: 'error',
                title: "Payment Failed",
                text: data.message || 'Payment verification failed. Please try again.',
                confirmButtonText: 'OK'
            });
        }
    })
    .catch((error) => {
        Swal.fire({
            icon: 'error',
            title: "Error",
            text: error.message || 'Failed to place order. Please try again.',
            confirmButtonText: 'OK',
        });
    });
}