const puppeteer = require('puppeteer');
const dateFormat = require('dateformat');
var player = require('play-sound')({player: 'C:\\Program Files (x86)\\MPlayer for Windows\\MPlayer.exe'});

const urls = {
    availability: 'https://www.passaportonline.poliziadistato.it/GestioneDisponibilitaAction.do?codop=getDisponibilitaCittadino',
    login: 'https://www.passaportonline.poliziadistato.it/logInCittadino.do'
};
var exports = module.exports = {};

exports.timeout = function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.login = async function login(page) {
    await page.goto(urls.login);
    await page.waitForSelector('#codiceFiscale')
    await page.type('#codiceFiscale', 'BRNFNC95H02Z602B')
    await page.type('#password', 'Fbruneta2019!')
    await page.click('#btnSub')
    await Promise.all([
        page.goto(urls.availability),
        page.waitForNavigation()
    ]);
}

exports.main = async function main(pageLoaded) {
    // Set-up environment  
    const browser = await puppeteer.launch();
    let page = pageLoaded !== null? pageLoaded : await browser.newPage(); 
    let found = false;
    let triesCounter = 0;
    
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

        date = new Date(dataScraped[0]);
        if (date < new Date().getDate() + 30) {
            for (i = 0; i < 10; i++) {
                player.play('assets/sounds/bell.mp3', function(err){
                    if (err) throw err
                })  
                await this.timeout(2500);  
            }
            console.log('AEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE');
            console.log('ACHOOOOOOOOOOOOOOOU: ' + dateFormat(date, 'yyyy-mm-dd') + ' (' + dataScraped[1] + ')');
            //found = true;
        } else {
            console.log('Found: ' + dateFormat(date, 'yyyy-mm-dd') + ' (' + dataScraped[1] + ')' + ' @ ' + dateFormat(new Date(), 'yyyy-mm-dd h:MM:ss TT'));
            console.log('Re-trying in 60s...');

            if (triesCounter++ >= 15) { //Every 10 minutes
                let audio = player.play('assets/sounds/no.mp3', function(err){
                    if (err) throw err
                })
                await this.timeout(2500);
                audio.kill();
                triesCounter = 0;
            }
        }
        await this.timeout(60000);
    }    
    
    
    //await page.screenshot({path: 'example.png'});
    
    
    await browser.close();
}


exports.main(null);