import Alpaca from '@alpacahq/alpaca-trade-api';
import moment from 'moment-timezone';
import notifier from 'node-notifier';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import wavPlayer from 'node-wav-player';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKeyId = 'PK0MS97ZOP78L4TXI0A8';
const secretKey = 'XHwOg2ivfcpI1xm0vqiiyHj01c2AiMjfaPbKPu5j';

const alpaca = new Alpaca({
  keyId: apiKeyId,
  secretKey: secretKey,
  paper: true,
  usePolygon: false
});

const isVerbose = process.argv.includes('-v');
const isTestMode = process.argv.includes('-n');  // Check for -n flag

const stockholmTimezone = 'Europe/Stockholm';
const nyTimezone = 'America/New_York';

const preMarketOpenTimeNY = '04:00';
const marketOpenTimeNY = '09:30';
const marketCloseTimeNY = '16:00';
const postMarketCloseTimeNY = '20:00';

// Flags for notifications
let notifiedPreMarket = false;
let notifiedMarketOpen = false;
let notifiedMarketClose = false;
let notifiedPostMarketClose = false;

// Flag to ensure test notification runs only once
let hasTestNotified = false;

async function getNextMarketOpenDate() {
    try {
        const now = moment().tz(nyTimezone).format('YYYY-MM-DD');
        const response = await alpaca.getCalendar({ start: now, end: moment().add(1, 'month').format('YYYY-MM-DD') });

        const calendar = response;
        const nowNY = moment().tz(nyTimezone);
        let nextOpenDate = null;

        for (const day of calendar) {
            if (day.open && moment(day.date).isAfter(nowNY)) {
                nextOpenDate = moment(day.date).tz(nyTimezone);
                break;
            }
        }

        if (!nextOpenDate) {
            console.log('No upcoming trading days found in the calendar.');
        }

        return nextOpenDate;
    } catch (error) {
        console.error('Error fetching market calendar or no trading days available:', error);
        return null;
    }
}

function nyTimeToStockholmTime(nyTime, date) {
    return moment.tz(`${date} ${nyTime}`, nyTimezone).clone().tz(stockholmTimezone).format();
}

function parseSessionTime(nyTime, date) {
    return moment.tz(`${date} ${nyTime}`, nyTimezone).toDate();
}

function calculateCountdown(fromDate, toDate) {
    const duration = moment.duration(moment(toDate).diff(moment(fromDate)));
    return {
        hours: Math.floor(duration.asHours()),
        minutes: Math.floor(duration.minutes()),
        seconds: Math.floor(duration.seconds()),
        totalSeconds: duration.asSeconds()
    };
}


let colorState = false; // Initialize the colorState

async function updateCountdowns() {
    try {
        const nowStockholm = moment.tz(stockholmTimezone); // Current time in Stockholm
        const nowNY = nowStockholm.clone().tz(nyTimezone); // Convert Stockholm time to NY time

        let nextMarketOpenDate = await getNextMarketOpenDate();

        if (!nextMarketOpenDate) {
            console.log('Unable to determine the next open trading day.');
            return;
        }

        const preMarketOpenDate = parseSessionTime(preMarketOpenTimeNY, nextMarketOpenDate.format('YYYY-MM-DD'));
        const marketOpenDate = parseSessionTime(marketOpenTimeNY, nextMarketOpenDate.format('YYYY-MM-DD'));
        const marketCloseDate = parseSessionTime(marketCloseTimeNY, nextMarketOpenDate.format('YYYY-MM-DD'));
        const postMarketCloseDate = parseSessionTime(postMarketCloseTimeNY, nextMarketOpenDate.format('YYYY-MM-DD'));

        let countdownText = '';
        let countdownTime = '';  // Separate the time for styling

        // Calculate the remaining time for different market stages
        if (nowNY.isBefore(preMarketOpenDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), preMarketOpenDate);
            countdownText = `Pre-market is opening in: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) { // Less than 10 minutes
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) { // Less than 1 hour
                countdownTime = chalk.yellow.bold(countdownTime); // Solid yellow
            } else if (countdown.totalSeconds < 7200) { // Less than 2 hours but more than 1 hour
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime); // Cycling between red and yellow
            }

            if (!notifiedPreMarket && countdown.totalSeconds <= 10) {
                notifyUser('Pre Market Session is now open!');
                notifiedPreMarket = true;
            }
        } else if (nowNY.isBefore(marketOpenDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), marketOpenDate);
            countdownText = `Pre Market: Session `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) { // Less than 10 minutes
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) { // Less than 1 hour
                countdownTime = chalk.yellow.bold(countdownTime); // Solid yellow
            } else if (countdown.totalSeconds < 7200) { // Less than 2 hours but more than 1 hour
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime); // Cycling between red and yellow
            }

            if (!notifiedMarketOpen && countdown.totalSeconds <= 10) {
                notifyUser('Primary Trading Session is now open!');
                notifiedMarketOpen = true;
            }
        } else if (nowNY.isBefore(marketCloseDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), marketCloseDate);
            countdownText = `Primary Trading Session: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) { // Less than 10 minutes
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) { // Less than 1 hour
                countdownTime = chalk.yellow.bold(countdownTime); // Solid yellow
            } else if (countdown.totalSeconds < 7200) { // Less than 2 hours but more than 1 hour
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime); // Cycling between red and yellow
            }

            if (!notifiedMarketClose && countdown.totalSeconds <= 10) {
                notifyUser('Market Closing Bell!');
                notifiedMarketClose = true;
            }
        } else if (nowNY.isBefore(postMarketCloseDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), postMarketCloseDate);
            countdownText = `Post Market Session: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) { // Less than 10 minutes
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) { // Less than 1 hour
                countdownTime = chalk.yellow.bold(countdownTime); // Solid yellow
            } else if (countdown.totalSeconds < 7200) { // Less than 2 hours but more than 1 hour
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime); // Cycling between red and yellow
            }

            if (!notifiedPostMarketClose && countdown.totalSeconds <= 10) {
                notifyUser('Market is now closed for the day!');
                notifiedPostMarketClose = true;
            }
        } else {
            // Reset notification flags for the next day
            notifiedPreMarket = false;
            notifiedMarketOpen = false;
            notifiedMarketClose = false;
            notifiedPostMarketClose = false;

            const nextDay = nowNY.clone().add(1, 'day').format('YYYY-MM-DD');
            const nextPreMarketOpen = parseSessionTime(preMarketOpenTimeNY, nextDay);
            const countdown = calculateCountdown(nowNY.toDate(), nextPreMarketOpen);
            countdownText = `Next session (Pre-market) is opening in: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;
        }

        if (!isVerbose) {
            console.clear();
        }

        console.log(chalk.bold(countdownText) + countdownTime);  // Output with separate styles for text and time

        // Toggle color state every second for the cycling effect
        colorState = !colorState;

    } catch (error) {
        console.error(chalk.red('Error updating countdowns:', error));  // Error in red
    }
}



function notifyUser(message) {
    notifier.notify({
        title: 'Market Session Alert',
        message: message,
        sound: false,  // Disable sound in notifier
        wait: false   // Make sure notifications do not wait for user interaction
    });

    // Play sound using node-wav-player
    wavPlayer.play({
        path: path.join(__dirname, '/bell.wav')
    }).then(() => {
        console.log('Sound played successfully');
    }).catch((err) => {
        console.error('Error playing sound:', err);
    });
}

// Function to send a test notification
function sendTestNotification() {
    if (isTestMode && !hasTestNotified) {
        notifyUser('This is a test notification.');
        hasTestNotified = true;
    }
}

// Send a test notification if -n flag is present
sendTestNotification();

// Update countdowns every second
setInterval(updateCountdowns, 1000);
