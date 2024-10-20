import Alpaca from "@alpacahq/alpaca-trade-api";
import moment from "moment-timezone";
import notifier from "node-notifier";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import wavPlayer from "node-wav-player";
import minimist from "minimist";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKeyId = "PK0MS97ZOP78L4TXI0A8";
const secretKey = "XHwOg2ivfcpI1xm0vqiiyHj01c2AiMjfaPbKPu5j";

const alpaca = new Alpaca({
	keyId: apiKeyId,
	secretKey: secretKey,
	paper: true,
	usePolygon: false,
});

const args = minimist(process.argv.slice(3));
const isVerbose = args["v"];
const manualTime = args["t"];
const runOnce = args["O"];

const stockholmTimezone = "Europe/Stockholm";
const nyTimezone = "America/New_York";

const preMarketOpenTimeNY = "04:00";
const marketOpenTimeNY = "09:30";
const marketCloseTimeNY = "16:00";
const postMarketCloseTimeNY = "20:00";

// Define important market times
const breakingNewsStartNY = "07:00"; // Breaking News Start (NY Time)
const breakingNewsEndNY = "09:30"; // Breaking News End (NY Time)
const powerHourStartNY = "15:00"; // Power Hour Start (NY Time)
const powerHourEndNY = "16:00"; // Power Hour End (NY Time)

let notifiedPreMarket = false;
let notifiedMarketOpen = false;
let notifiedMarketClose = false;
let notifiedPostMarketClose = false;

let colorState = false; // For alternating color of countdown text

/**
 * Verbose logging function.
 *
 * @param {String} message - The message to log.
 */
function logVerbose(message) {
	if (isVerbose) {
		console.log(chalk.cyan(`[Verbose] ${message}`));
	}
}

/**
 * Get the key periods for market activity, including Breaking News and Power Hour.
 *
 * @param {Object} nextMarketOpenDate - Moment.js object for the next market open date.
 * @return {Object} Key market period times.
 */
function getMarketPeriods(nextMarketOpenDate) {
	try {
		const breakingNewsStart = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${breakingNewsStartNY}`,
			nyTimezone
		);
		const breakingNewsEnd = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${breakingNewsEndNY}`,
			nyTimezone
		);
		const powerHourStart = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${powerHourStartNY}`,
			nyTimezone
		);
		const powerHourEnd = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${powerHourEndNY}`,
			nyTimezone
		);

		logVerbose(
			`Breaking News Start Time: ${breakingNewsStart.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Breaking News End Time: ${breakingNewsEnd.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Power Hour Start Time: ${powerHourStart.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Power Hour End Time: ${powerHourEnd.format("YYYY-MM-DD HH:mm:ss")}`
		);

		return {
			breakingNewsStart,
			breakingNewsEnd,
			powerHourStart,
			powerHourEnd,
		};
	} catch (error) {
		console.error("Error getting market periods:", error);
		return null;
	}
}

/**
 * Get current time in Stockholm or New York based on manual time (-t flag).
 *
 * @return {Object} An object with both the current Stockholm and NY times.
 */
function getCurrentTimes() {
	try {
		let nowStockholm;
		if (manualTime) {
			const [hours, minutes] = manualTime.split(":");
			nowStockholm = moment
				.tz(stockholmTimezone)
				.set({ hour: hours, minute: minutes, second: 0 });
			logVerbose(
				`Manual Stockholm time set to: ${nowStockholm.format(
					"YYYY-MM-DD HH:mm:ss"
				)}`
			);
		} else {
			nowStockholm = moment.tz(stockholmTimezone);
		}
		const nowNY = nowStockholm.clone().tz(nyTimezone);

		logVerbose(
			`Current time in Stockholm: ${nowStockholm.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Current time in New York: ${nowNY.format("YYYY-MM-DD HH:mm:ss")}`
		);

		return { nowStockholm, nowNY };
	} catch (error) {
		console.error("Error getting current time:", error);
		return null;
	}
}

/**
 * Get the pre-market, market open, close, and post-market close times for a given market date.
 *
 * @param {Object} nextMarketOpenDate - Moment.js object for the next market open date.
 * @return {Object} An object with all key session times (pre-market, open, close, post-market).
 */
function getMarketSessionTimes(nextMarketOpenDate) {
	try {
		const preMarketOpenDate = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${preMarketOpenTimeNY}`,
			nyTimezone
		);
		const marketOpenDate = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${marketOpenTimeNY}`,
			nyTimezone
		);
		const marketCloseDate = moment.tz(
			`${nextMarketOpenDate.format("YYYY-MM-DD")} ${marketCloseTimeNY}`,
			nyTimezone
		);
		const postMarketCloseDate = moment.tz(
			`${nextMarketOpenDate.format(
				"YYYY-MM-DD"
			)} ${postMarketCloseTimeNY}`,
			nyTimezone
		);

		logVerbose(
			`Pre-market open time (NY): ${preMarketOpenDate.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Market open time (NY): ${marketOpenDate.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Market close time (NY): ${marketCloseDate.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);
		logVerbose(
			`Post-market close time (NY): ${postMarketCloseDate.format(
				"YYYY-MM-DD HH:mm:ss"
			)}`
		);

		return {
			preMarketOpenDate,
			marketOpenDate,
			marketCloseDate,
			postMarketCloseDate,
		};
	} catch (error) {
		console.error("Error getting market session times:", error);
		return null;
	}
}
/**
 * Calculate and display the countdown between two times.
 *
 * @param {Object} nowNY - Moment.js object for current NY time.
 * @param {Object} sessionTime - Moment.js object for the market session time (pre-market, market open, etc.).
 * @param {String} sessionName - A descriptive name for the session.
 * @return {String} Formatted countdown string.
 */
function getCountdownText(nowNY, sessionTime, sessionName) {
	const countdown = calculateCountdown(nowNY.toDate(), sessionTime);
	let countdownText = "";

	// Adjust wording for specific sessions
	if (sessionName === "Market Close") {
		countdownText = `${sessionName} in: `;
	} else if (sessionName === "Market") {
		countdownText = `Market opens in: `;
	} else if (sessionName === "Pre-market") {
		countdownText = `Pre-market opens in: `;
	} else if (sessionName === "Post-market") {
		countdownText = `Post-market closes in: `;
	}

	let countdownTime = `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`;

	if (countdown.totalSeconds < 600) {
		countdownTime = colorState
			? chalk.bgRedBright.bold(countdownTime)
			: chalk.bgRed.bold(countdownTime);
	} else if (countdown.totalSeconds < 3600) {
		countdownTime = chalk.yellow.bold(countdownTime);
	} else if (countdown.totalSeconds < 7200) {
		countdownTime = colorState
			? chalk.red.bold(countdownTime)
			: chalk.yellow.bold(countdownTime);
	}

	logVerbose(`${sessionName} countdown: ${countdownTime}`);
	return `${countdownText} ${countdownTime}`;
}

/**
 * Main function to update countdowns for market sessions.
 */
/**
 * Main function to update countdowns for market sessions and notify the user.
 */
async function updateCountdowns() {
	try {
		const { nowStockholm, nowNY } = getCurrentTimes();
		if (!nowNY) return;

		const nextMarketOpenDate = await getNextMarketOpenDate();
		if (!nextMarketOpenDate) {
			console.log("Unable to determine the next open trading day.");
			return;
		}

		const {
			preMarketOpenDate,
			marketOpenDate,
			marketCloseDate,
			postMarketCloseDate,
		} = getMarketSessionTimes(nextMarketOpenDate);
		const {
			breakingNewsStart,
			breakingNewsEnd,
			powerHourStart,
			powerHourEnd,
		} = getMarketPeriods(nextMarketOpenDate);

		let countdownDisplay = "";

		// Notify and highlight Pre-market
		if (nowNY.isBefore(preMarketOpenDate)) {
			countdownDisplay = getCountdownText(
				nowNY,
				preMarketOpenDate,
				"Pre-market"
			);

			// Notify when Pre-market is near (less than 10 seconds)
			const countdown = calculateCountdown(
				nowNY.toDate(),
				preMarketOpenDate
			);
			if (!notifiedPreMarket && countdown.totalSeconds <= 10) {
				notifyUser("Pre-market is now open!");
				notifiedPreMarket = true;
			}
		}
		// Notify and highlight Breaking News period
		else if (nowNY.isBetween(breakingNewsStart, breakingNewsEnd)) {
			countdownDisplay = chalk.red.bold(
				`BREAKING NEWS period active! Ends in: ${getCountdownText(
					nowNY,
					breakingNewsEnd,
					"Breaking News"
				)}`
			);

			// Notify during Breaking News
			if (!notifiedMarketOpen) {
				notifyUser("BREAKING NEWS period has started!");
				notifiedMarketOpen = true;
			}
		}
		// Notify and highlight Market Open
		else if (nowNY.isBefore(marketOpenDate)) {
			countdownDisplay = getCountdownText(
				nowNY,
				marketOpenDate,
				"Market"
			);

			// Notify when Market Open is near (less than 10 seconds)
			const countdown = calculateCountdown(
				nowNY.toDate(),
				marketOpenDate
			);
			if (!notifiedMarketOpen && countdown.totalSeconds <= 10) {
				notifyUser("Market is now open!");
				notifiedMarketOpen = true;
			}
		}
		// Notify and highlight Power Hour
		else if (nowNY.isBetween(powerHourStart, powerHourEnd)) {
			countdownDisplay = chalk.green.bold(
				`POWER HOUR active! Ends in: ${getCountdownText(
					nowNY,
					powerHourEnd,
					"Power Hour"
				)}`
			);

			// Notify during Power Hour
			if (!notifiedMarketClose) {
				notifyUser("Power Hour has started!");
				notifiedMarketClose = true;
			}
		}
		// Regular market session countdowns (Market Close)
		else if (nowNY.isBefore(marketCloseDate)) {
			countdownDisplay = getCountdownText(
				nowNY,
				marketCloseDate,
				"Market Close"
			);

			// Notify when Market Close is near (less than 10 seconds)
			const countdown = calculateCountdown(
				nowNY.toDate(),
				marketCloseDate
			);
			if (!notifiedMarketClose && countdown.totalSeconds <= 10) {
				notifyUser("Market is about to close!");
				notifiedMarketClose = true;
			}
		}
		// Post-market session countdowns
		else if (nowNY.isBefore(postMarketCloseDate)) {
			countdownDisplay = getCountdownText(
				nowNY,
				postMarketCloseDate,
				"Post-market"
			);

			// Notify when Post Market Close is near (less than 10 seconds)
			const countdown = calculateCountdown(
				nowNY.toDate(),
				postMarketCloseDate
			);
			if (!notifiedPostMarketClose && countdown.totalSeconds <= 10) {
				notifyUser("Post-market session is about to close!");
				notifiedPostMarketClose = true;
			}
		}

		if (!isVerbose) console.clear();
		console.log(countdownDisplay);
	} catch (error) {
		console.error("Error updating countdowns:", error);
	}
}

/**
 * Calculate the countdown between two dates.
 *
 * @param {Date} fromDate - The starting date.
 * @param {Date} toDate - The ending date.
 * @return {Object} Countdown details (hours, minutes, seconds, totalSeconds).
 */
function calculateCountdown(fromDate, toDate) {
	const duration = moment.duration(moment(toDate).diff(moment(fromDate)));
	return {
		hours: Math.floor(duration.asHours()),
		minutes: Math.floor(duration.minutes()),
		seconds: Math.floor(duration.seconds()),
		totalSeconds: duration.asSeconds(),
	};
}
let lastMarketOpenFetchTime = null; // Variable to store the last API call time in memory

/**
 * Fetch the next market open date based on Alpaca's calendar.
 * Only fetch if 24 hours have passed since the last fetch.
 * @return {Object} The next market open date as a Moment.js object.
 */
async function getNextMarketOpenDate() {
    // Check if 24 hours have passed since the last fetch
    if (lastMarketOpenFetchTime) {
        const now = moment();
        const diffHours = now.diff(lastMarketOpenFetchTime, 'hours');
        if (diffHours < 24) {
            console.log('Less than 24 hours since last fetch. Skipping API call.');
            return lastMarketOpenFetchTime; // Return cached date if within 24 hours
        }
    }

    try {
        const now = moment().tz(nyTimezone);
        const todayIsFriday = now.day() === 5;
        const marketCloseToday = moment.tz(`${now.format('YYYY-MM-DD')} ${marketCloseTimeNY}`, nyTimezone);

        const response = await alpaca.getCalendar({ start: now.format('YYYY-MM-DD'), end: moment().add(1, 'month').format('YYYY-MM-DD') });
        const calendar = response;
        let nextOpenDate = null;

        for (const day of calendar) {
            if (todayIsFriday && now.isBefore(marketCloseToday)) {
                nextOpenDate = now;
                break;
            }
            if (day.open && moment(day.date).isAfter(now) && moment(day.date).day() !== 0 && moment(day.date).day() !== 6) {
                nextOpenDate = moment(day.date).tz(nyTimezone);
                break;
            }
        }

        if (nextOpenDate && (nextOpenDate.day() === 0 || nextOpenDate.day() === 6)) {
            logVerbose(`Next trading day falls on a weekend. Adjusting to next Monday.`);
            nextOpenDate = nextOpenDate.add(1, 'weeks').startOf('isoWeek');
        }

        // Update the last fetch time
        lastMarketOpenFetchTime = nextOpenDate;

        logVerbose(`Next market open date (NY time): ${nextOpenDate.format('YYYY-MM-DD')} (${nextOpenDate.format('dddd')})`);

        return nextOpenDate;
    } catch (error) {
        console.error('Error fetching market calendar or no trading days available:', error);
        return null;
    }
}

/**
 * Send a notification to the user.
 *
 * @param {String} message - The notification message.
 */
function notifyUser(message) {
	notifier.notify({
		title: "Market Notification",
		message: message,
		icon: path.join(__dirname, "bell.png"),
		sound: true,
	});
	wavPlayer.play({
		path: path.join(__dirname, "bell.wav"),
	});
}

// Run the countdown updates based on verbose or regular mode
if (runOnce) {
	updateCountdowns();
} else {
	setInterval(updateCountdowns, 1000);
}
