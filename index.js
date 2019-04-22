const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
var beep = require('beepbeep')

moment.tz.setDefault(config.timezoneCode);
var exports = module.exports = {};
const isPkg = typeof process.pkg !== 'undefined';
const urls = {
    availability: 'https://www.passaportonline.poliziadistato.it/GestioneDisponibilitaAction.do?codop=getDisponibilitaCittadino',
    login: 'https://www.passaportonline.poliziadistato.it/logInCittadino.do'
};

exports.timeout = function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.login = async function login(page) {
    await page.goto(urls.login);
    await page.waitForSelector('#codiceFiscale')
    await page.type('#codiceFiscale', config.username)
    await page.type('#password', config.password)
    await page.click('#btnSub')
  }

exports.main = async function main(pageLoaded) { 
    const limit  = moment(config.limitDate);
    let startDate = moment(config.startDate);
    let found = false;
    let triesCounter = 0;

    //Start Browser (Chrome/Chromium)
    const browser = await puppeteer.launch({
        executablePath: isPkg ? config.chromePath: puppeteer.executablePath(),
        headless: config.headless
    });
    let page = pageLoaded !== null? pageLoaded : await browser.newPage(); 

    while(true) {

        if (startDate > limit) { // Restart process
            startDate = moment(config.startDate);
        }

        console.log("Loading availability page");
        await Promise.all([
            page.goto(urls.availability + '&previous=false&data=' + startDate.format('DD-MM-YYYY')),
            page.waitForNavigation()
        ]);

        // Checks if user is logged in (by reading cookies)
        let cookies = await page._client.send('Network.getAllCookies');
        const cookieSession = cookies.cookies.find((el) => el.path == '/js');
        if (cookieSession === undefined) {
            console.log('Starting Session...')
            await this.login(page).then(() => {
                console.log('Logged in');
                page.goto(urls.availability + '&previous=false&data=' + startDate.format('DD-MM-YYYY')),
                page.waitForNavigation();
            });
        }

        // Try to find dates that are available
        await page.waitForSelector('#message_box_xl_dispo > table.naviga_disponibilita > tbody > tr > td:nth-child(2)', { visible : true })
        let dataScraped = await page.evaluate(() => {
            let arrayReturn = [];
            arrayReturn.push(document.querySelector('#message_box_xl_dispo > table.naviga_disponibilita > tbody > tr > td:nth-child(2)').innerText);
            const cities = document.querySelectorAll('#message_box_xl_dispo > table.list_disponibilita > tbody > tr:not(:first-child)');
            let availableCities = [];
            for (city of cities) {
                availableCities.push({name: city.children[1].innerText, available: city.children[2].innerText});
            }
            arrayReturn.push(availableCities);
            return arrayReturn;
        });
        
        dataScraped[1] = dataScraped[1].filter(r => !config.placesBlackList.includes(r.name)); // Remove blacklisted cities
        let date = moment(dataScraped[0].substring(0,10)); // Get scraped date
        
        if (dataScraped[1].length == 0) { //No cities found
            startDate = date;
            console.log("No cities Found! Searching for the next day: " + startDate.format('DD-MM-YYYY'));
            await this.timeout(800);  
            continue;
        }

        if (date <= limit) {
            found = true;
            for (i = 0; i < 10; i++) {
                beep(3, 1000);
				console.log('FOOOOOOOOOOOOOOOOOOOOOOUNDDDDDDD: ' + date.format('DD/MM/YYYY') + ' (' + JSON.stringify(dataScraped[1]) + ')');
                await this.timeout(2500);  
            }
        } else {
            found = false;
            console.log('Sorry, no date availabe. Found ' + date.format('DD/MM/YYYY') + 
                 ' (' + JSON.stringify(dataScraped[1]) + ')' + ' @ ' + moment().format() + 
                ', Limit: ' + limit.format('DD/MM/YYYY')
            );
            if (triesCounter++ >= 15) { //Every 15 minutes
                await this.timeout(2000);
                triesCounter = 0;
            }
        }
        console.log('Re-trying in ' + (found? 10 : config.timeout) + 's...');
        await this.timeout((found? 10 : config.timeout) * 1000);
    }
    await browser.close();
}

exports.main(null);