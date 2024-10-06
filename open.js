import Alpaca from '@alpacahq/alpaca-trade-api';
import moment from 'moment-timezone';
import notifier from 'node-notifier';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import wavPlayer from 'node-wav-player';
import minimist from 'minimist';  // Add minimist for argument parsing
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

const args = minimist(process.argv.slice(2));  // Parse command-line arguments
const isVerbose = args['v'];
const isTestMode = args['n'];  // Check for -n flag
const manualTime = args['t'];   // Check for -t flag (manual Stockholm time)

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

function logVerbose(message) {
    if (isVerbose) {
        console.log(chalk.cyan(`[Verbose] ${message}`));
    }
}

async function getNextMarketOpenDate() {
    try {
        const now = moment().tz(nyTimezone);
        const todayIsFriday = now.day() === 5;
        const marketCloseToday = moment.tz(`${now.format('YYYY-MM-DD')} ${marketCloseTimeNY}`, nyTimezone);

        // Fetch market calendar
        const response = await alpaca.getCalendar({ start: now.format('YYYY-MM-DD'), end: moment().add(1, 'month').format('YYYY-MM-DD') });
        const calendar = response;
        let nextOpenDate = null;

        for (const day of calendar) {
            // If today is Friday and the market hasn't closed yet, consider today as the trading day.
            if (todayIsFriday && now.isBefore(marketCloseToday)) {
                nextOpenDate = now;
                break;
            }

            // Check if the date is after current time and it is not a weekend (Sat/Sun)
            if (day.open && moment(day.date).isAfter(now) && moment(day.date).day() !== 0 && moment(day.date).day() !== 6) {
                nextOpenDate = moment(day.date).tz(nyTimezone);
                break;
            }
        }

        if (isVerbose) {
            if (!nextOpenDate) {
                console.log('No upcoming trading days found in the calendar.');
            } else if (moment(nextOpenDate).isSame(now, 'day')) {
                console.log('Today is a valid trading day.');
            } else if (nextOpenDate.day() === 0 || nextOpenDate.day() === 6) {
                console.log('Next trading day falls on a weekend. Adjusting to next Monday.');
            }
        }

        // Handle case when next open date is over the weekend (skip to Monday)
        if (nextOpenDate && (nextOpenDate.day() === 0 || nextOpenDate.day() === 6)) {
            logVerbose(`Next trading day falls on a weekend. Adjusting to next Monday.`);
            nextOpenDate = nextOpenDate.add(1, 'weeks').startOf('isoWeek');  // Move to next Monday
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
        let nowStockholm;

        if (manualTime) {
            // If -t flag is provided, use the manually set Stockholm time
            const [hours, minutes] = manualTime.split(':');
            nowStockholm = moment.tz(stockholmTimezone).set({ hour: hours, minute: minutes, second: 0 });
            logVerbose(`Manual Stockholm time set to: ${nowStockholm.format('YYYY-MM-DD HH:mm:ss')}`);
        } else {
            nowStockholm = moment.tz(stockholmTimezone); // Use current time in Stockholm
        }

        const nowNY = nowStockholm.clone().tz(nyTimezone); // Convert Stockholm time to NY time

        // Log current time in both timezones and day of the week
        logVerbose(`Current time in Stockholm: ${nowStockholm.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Day in Stockholm: ${nowStockholm.format('dddd')}`);
        logVerbose(`Current time in New York: ${nowNY.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Day in New York: ${nowNY.format('dddd')}`);

        // Fetch the next market open date (ensure it's skipping the weekend)
        let nextMarketOpenDate = await getNextMarketOpenDate();

        if (!nextMarketOpenDate) {
            console.log('Unable to determine the next open trading day.');
            return;
        }

        logVerbose(`Next market open date (NY time): ${nextMarketOpenDate.format('YYYY-MM-DD')} (${nextMarketOpenDate.format('dddd')})`);

        const preMarketOpenDate = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} ${preMarketOpenTimeNY}`, nyTimezone);
        const marketOpenDate = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} ${marketOpenTimeNY}`, nyTimezone);
        const marketCloseDate = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} ${marketCloseTimeNY}`, nyTimezone);
        const postMarketCloseDate = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} ${postMarketCloseTimeNY}`, nyTimezone);

        logVerbose(`Pre-market open time (NY): ${preMarketOpenDate.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Market open time (NY): ${marketOpenDate.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Market close time (NY): ${marketCloseDate.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Post-market close time (NY): ${postMarketCloseDate.format('YYYY-MM-DD HH:mm:ss')}`);

        let countdownText = '';
        let countdownTime = '';

        // Breaking News: from 07:00 to 09:30 NY time
        const breakingNewsStart = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} 07:00`, nyTimezone); // 07:00 NY time
        const breakingNewsEnd = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} 09:30`, nyTimezone); // 09:30 NY time

        // Power Hours: from 07:00 to 09:30 NY time
        const powerHourStart = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} 14:00`, nyTimezone); // 14:00 NY time
        const powerHourEnd = moment.tz(`${nextMarketOpenDate.format('YYYY-MM-DD')} 16:00`, nyTimezone); // 16:00 NY time

        // Log the breaking news times
        logVerbose(`Breaking News Start Time: ${breakingNewsStart.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Breaking News End Time: ${breakingNewsEnd.format('YYYY-MM-DD HH:mm:ss')}`);
        logVerbose(`Current NY Time: ${nowNY.format('YYYY-MM-DD HH:mm:ss')}`);


        if (nowNY.isBefore(preMarketOpenDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), preMarketOpenDate);
            countdownText = `Pre-market is opening in: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) {
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) {
                countdownTime = chalk.yellow.bold(countdownTime);
            } else if (countdown.totalSeconds < 7200) {
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime);
            }

            if (!notifiedPreMarket && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Pre-market', 'Pre Market Session is now open!', 'Pre-market opens', preMarketOpenDate);
                notifiedPreMarket = true;
            }
        } else if (nowNY.isBetween(breakingNewsStart, breakingNewsEnd)) {
            const countdown = calculateCountdown(nowNY.toDate(), breakingNewsEnd);
            countdownText = chalk.red.bold(`Breaking News: `);
            countdownTime = chalk.red.bold(`${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`);

            // Breaking news notification
            if (!notifiedMarketOpen && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Breaking News', 'Breaking News: Primary Trading Session started!', 'Breaking News', breakingNewsEnd);
                notifiedMarketOpen = true;
            }
        }else if (nowNY.isBefore(marketOpenDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), marketOpenDate);
            countdownText = `Pre Market: Session `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (countdown.totalSeconds < 600) {
                countdownTime = colorState ? chalk.bgRedBright.bold(countdownTime) : chalk.bgRed.bold(countdownTime);
            } else if (countdown.totalSeconds < 3600) {
                countdownTime = chalk.yellow.bold(countdownTime);
            } else if (countdown.totalSeconds < 7200) {
                countdownTime = colorState ? chalk.red.bold(countdownTime) : chalk.yellow.bold(countdownTime);
            }

            if (!notifiedMarketOpen && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Market Open', 'Primary Trading Session is now open!', 'Pre Market: Session', marketOpenDate);
                notifiedMarketOpen = true;
            }
        }  else if (nowStockholm.isBetween(powerHourStart, powerHourEnd)) {
            const countdown = calculateCountdown(nowNY.toDate(), powerHourEnd);
            countdownText = `Power Hour: `;
            countdownTime = chalk.red.bold(`${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`);

            if (!notifiedMarketClose && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Power Hour', 'Power Hour has started!', 'Power Hour', powerHourEnd);
                notifiedMarketClose = true;
            }
        } else if (nowNY.isBefore(marketCloseDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), marketCloseDate);
            countdownText = `Primary Trading Session: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (!notifiedMarketClose && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Market Close', 'Market Closing Bell!', 'Primary Trading Session', marketCloseDate);
                notifiedMarketClose = true;
            }
        } else if (nowNY.isBefore(postMarketCloseDate)) {
            const countdown = calculateCountdown(nowNY.toDate(), postMarketCloseDate);
            countdownText = `Post Market Session: `;
            countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

            if (!notifiedPostMarketClose && countdown.totalSeconds <= 10) {
                checkAndNotifyPeriodChange('Post Market', 'Post Market Session Closing!', 'Post Market Session', postMarketCloseDate);
                notifiedPostMarketClose = true;
            }
        }

        // Clear the console before printing the next countdown to act like a clock
        if(!isVerbose) console.clear();
        console.log(`${countdownText} ${countdownTime}`);
    } catch (error) {
        console.error('Error updating countdowns:', error);
    }
}



function notifyUser(message) {
    notifier.notify({
        title: 'Market Notification',
        message: message,
        icon: path.join(__dirname, 'bell.png'),
        sound: true
    });
    wavPlayer.play({
        path: path.join(__dirname, 'bell.wav')
    });
}

// At the bottom of your file
if (isVerbose) {
    // Run the updateCountdowns function once immediately
    updateCountdowns();
} else {
    // Run updateCountdowns every second in non-verbose mode
    setInterval(updateCountdowns, 1000);
}
