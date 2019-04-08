const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const puppeteer = require('puppeteer');
const dateFormat = require('dateformat');
const player = require('play-sound')({player: config.mPlayerPath});
const moment = require('moment-timezone');

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
    const browser = await puppeteer.launch({executablePath: isPkg ? config.chromePath: puppeteer.executablePath()});
    let page = pageLoaded !== null? pageLoaded : await browser.newPage(); 

    // Find Dates
    await page.goto(urls.availability);
    while(found === false) {
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
            for (i = 0; i < 10; i++) {
                player.play('assets/sounds/bell.mp3', function(err){
                    if (err) throw err
                });
				console.log('FOOOOOOOOOOOOOOOOOOOOOOUNDDDDDDD: ' + date.format('YYYY-MM-DD') + ' (' + dataScraped[1] + ')');
                await this.timeout(2500);  
            }
        } else {
            console.log('Sorry, no date availabe. Found ' + date.format('YYYY-MM-DD') + 
                ' (' + dataScraped[1] + ')' + ' @ ' + moment().format() + 
                ', Limit: ' + limit.format('YYYY-MM-DD')
            );

            if (triesCounter++ >= 15) { //Every 15 minutes
                let audio = player.play('assets/sounds/no.mp3', function(err){
                    if (err) throw err
                })
                await this.timeout(2000);
                audio.kill();
                triesCounter = 0;
            }
        }
        console.log('Re-trying in ' + config.timeout + 's...');
        await this.timeout(config.timeout * 1000);
    }        
    await browser.close();
}

exports.main(null);