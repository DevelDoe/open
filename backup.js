const readline = require('readline')
const dateFns = require('date-fns')
const Alpaca = require('@alpacahq/alpaca-trade-api')
const { formatToTimeZone } = require('date-fns-timezone')
const countdown = require('countdown')

const apiKeyId = 'PK0MS97ZOP78L4TXI0A8'
const secretKey = 'XHwOg2ivfcpI1xm0vqiiyHj01c2AiMjfaPbKPu5j'

/* const format = `yyyy-MM-dd HH:mm:ss` 
const today = new Date()
console.log(dateFns.format(today, format)) */


const timeZone = 'America/Toronto'
const edtFormat = 'YYYY-MM-DD HH:mm:ss.SSS [GMT]Z (z)'
const edtDate = formatToTimeZone(new Date(), edtFormat, { timeZone })

// console.log(edtDate)

const alpaca = new Alpaca({
    keyId: apiKeyId,
    secretKey: secretKey,
    paper: true,
    usePolygon: false
})

alpaca
.getClock()
.then((clock) => {
    console.log(`The market is ${clock.is_open ? 'open.' : 'closed.'}`)
})


// Create a new Date object for the current date and time
const cDate = new Date();

// Create a new Date object for one week later
const oneWeekLater = new Date(cDate);  // Clone the current date
oneWeekLater.setDate(cDate.getDate() + 7);  // Add 7 days

let openDate = null; // Store the open date here

async function initializeCalendar() {
    try {
        // Fetch the market calendar
        const calendar = await alpaca.getCalendar({ start: new Date(), end: oneWeekLater });

        // Initialize an empty array
        var oDate = [];

        // Populate oDate with the fetched data
        calendar.forEach(d => {
            oDate.push(d);
        });

        if (oDate.length === 0) {
            console.log('No data available.');
            return;
        }


        let [year, month, day] = oDate[0].date.split('-')
        let [hours, minutes] = oDate[0].open.split(':')
        year = parseInt(year, 10)
        month = parseInt(month, 10)
        day = parseInt(day, 10)
        hours = parseInt(hours, 10)
        minutes = parseInt(minutes, 10)

        // Create a Date object for the open time
        openDate = new Date(year, month - 1, day, hours, minutes);

        console.log('Market opens: ', openDate);

       
    } catch (err) {
      console.error('Error fetching market calendar:', err);
    }
  }

// Function to calculate and log the countdown
function updateCountdown() {
    if (!openDate) {
        console.log('Open date not set.');
        return;
    }

    // Get the current date and time
    const currentDate = new Date();
    // Adjust the current time by subtracting 6 hours
    currentDate.setHours(currentDate.getHours() - 6);

    // Calculate the countdown (assuming you have a countdown function)
    const timeDifference = countdown(currentDate, openDate, countdown.HOURS | countdown.MINUTES | countdown.SECONDS).toString();
    console.clear();
    console.log(`Market Countdown: ${timeDifference}`);
}
  
// Initialize calendar and set interval to update countdown
initializeCalendar().then(() => {
    // Set up the interval to update countdown periodically
    setInterval(updateCountdown, 1000); // Update every 10 seconds (adjust as needed)

    // Call the update function immediately to get the initial countdown
    updateCountdown();
});


/*   oDate = new Date(day.date)
  var year = oDate.getFullYear()
  var month = oDate.getMonth() 
  var dday = oDate.getDate() 


  let [hours, minutes] = day.open.split(':');
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);



  console.log(`Date: ${day.date}, Open: ${day.open}, Close: ${day.close}`); 

        // Get the current date and time
        const currentDate = new Date();

        // Add 6 hours to the current time
        currentDate.setHours(currentDate.getHours() - 6);
        console.log(countdown(currentDate,  new Date(year, month, dday, hours, minutes), countdown.HOURS | countdown.MINUTES | countdown.SECONDS).hours)

// Function to format the current time
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  // Function to clear the console and print the current time
  function printClock() {
    console.clear();  // Clear the console window for a real-time clock effect
    console.log("Current Time: ", getCurrentTime());
  }
  
  // Run the clock every second
  setInterval(printClock, 1000);  
  


  
/* 
Y





// Function to calculate percentage change
function calculatePercentageChange(startPrice, endPrice) {
    let change = ((endPrice - startPrice) / startPrice) * 100;
    return change.toFixed(2); // rounding to two decimal places
}




const readline = require('readline')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var cp;

rl.question('Closing price: ', (c) => {
    cp = c;
    
    console.log(`close price is: ${cp}`)

    // run the calculation function
    const percentageChange = calculatePercentageChange(cp, 10);
    // print the results
    console.log(`The percentage change from ${cp} to ${10} is ${percentageChange}%`); 

    rl.close()
});



 */