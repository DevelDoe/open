import notifier from 'node-notifier';

function sendTestNotification() {
    console.log('Sending test notification...');  // Debug log
    notifier.notify({
        title: 'Test Notification',
        message: 'This is a test notification from node-notifier!',
        sound: true,
        wait: false
    }, (err, response) => {
        if (err) {
            console.error('Notification error:', err);
        } else {
            console.log('Notification response:', response);
        }
    });
}

sendTestNotification();  // Ensure the function is called
