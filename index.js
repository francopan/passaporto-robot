const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const puppeteer = require('puppeteer');
const moment = require('moment-timezone');
var beep = require('beepbeep')

// Global Variables and set-ups
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
    await Promise.all([
        page.goto(urls.availability),
        page.waitForNavigation()
    ]);
}

exports.main = async function main(pageLoaded) { 
    const limit  = moment(config.limitDate);
    let found = false;
    let triesCounter = 0;

    //Start Browser (Chrome/Chromium)
    const browser = await puppeteer.launch({
        executablePath: isPkg ? config.chromePath: puppeteer.executablePath(),
        headless: true, // Speech synth API doesn't work in headless. crbug.com/815388
        args: ['--window-size=0,0','--window-position=0,0',]
    });
    let page = pageLoaded !== null? pageLoaded : await browser.newPage(); 

    // Find Dates
     await Promise.all([
        page.goto(urls.availability),
        page.waitForNavigation()
    ]);
    while(true) {
        console.log("Loading availability page");
        await Promise.all([
            page.goto(urls.availability),
            page.waitForNavigation()
        ]);
        let cookies = await page._client.send('Network.getAllCookies');
        const cookieSession = cookies.cookies.find((el) => el.path == '/js');
        
        if (cookieSession === undefined) {
            console.log('Starting Session...')
            await this.login(page).then(() => {
                console.log('Logged in');
            });
        }
        
        let dataScraped = await page.evaluate(() => {
            let arrayReturn = [];
            arrayReturn.push(document.querySelector('#message_box_xl_dispo > table.naviga_disponibilita > tbody > tr > td:nth-child(2)').innerText);
            arrayReturn.push(document.querySelector('#message_box_xl_dispo > table.list_disponibilita > tbody > tr:nth-child(2) > td.dispo').innerText);
            return arrayReturn;
        })

        let date = moment(dataScraped[0].substring(0,10));
        if (date <= limit) {
            found = true;
            for (i = 0; i < 10; i++) {
                beep(3, 1000);
				console.log('FOOOOOOOOOOOOOOOOOOOOOOUNDDDDDDD: ' + date.format('DD/MM/YYYY') + ' (' + dataScraped[1] + ')');
                await this.timeout(2500);  
            }
        } else {
            found = false;
            console.log('Sorry, no date availabe. Found ' + date.format('DD/MM/YYYY') + 
                ' (' + dataScraped[1] + ')' + ' @ ' + moment().format() + 
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