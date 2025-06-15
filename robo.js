const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// ✅ Variável global para pausa manual
global.botPaused = false;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    }
});

// ✅ Salvar referência do cliente
global.botClient = client;

let botActive = true;
let pauseTimeout;
const PAUSE_DURATION = 10 * 60 * 1000;

client.on('qr', qr => {
    console.log('📱 QR Code gerado!');
    qrcode.generate(qr, {small: true});
    
    // Salvar QR para interface web
    global.currentQR = qr;
    global.botStatus = 'Aguardando QR Code';
    
    console.log('QR salvo globalmente:', !!global.currentQR);
    
    // Emitir para interface web
    if (global.io) {
        console.log('📡 Enviando QR via Socket.IO');
        const QRCode = require('qrcode');
        QRCode.toDataURL(qr).then(qrImage => {
            global.io.emit('qr-update', { 
                qr: qrImage, 
                status: 'Aguardando QR Code' 
            });
        }).catch(err => {
            console.error('Erro ao converter QR:', err);
        });
    } else {
        console.log('⚠️ Socket.IO não disponível');
    }
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
    global.currentQR = null;
    global.botStatus = 'Conectado';
    
    if (global.io) {
        global.io.emit('status-update', { 
            status: 'Conectado',
            hasQR: false 
        });
    }
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado!');
    global.botStatus = 'Autenticado';
    global.currentQR = null;
    
    if (global.io) {
        global.io.emit('status-update', { 
            status: 'Autenticado',
            hasQR: false 
        });
    }
});

client.on('auth_failure', msg => {
    console.error('❌ Falha na autenticação:', msg);
    global.botStatus = 'Erro de autenticação';
    global.currentQR = null;
    
    if (global.io) {
        global.io.emit('status-update', { 
            status: 'Erro de autenticação',
            hasQR: false 
        });
    }
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Cliente desconectado:', reason);
    global.botStatus = 'Desconectado';
    global.currentQR = null;
    
    if (global.io) {
        global.io.emit('status-update', { 
            status: 'Desconectado',
            hasQR: false 
        });
    }
});

console.log('🚀 Inicializando cliente WhatsApp...');
client.initialize().catch((err) => {
    console.error('❌ Erro ao inicializar cliente:', err);
    global.botStatus = 'Erro na inicialização';
});

const delay = ms => new Promise(res => setTimeout(res, ms));

// Função para pausar o bot
function pauseBotForUserControl() {
    botActive = false;
    console.log('⏸️ Bot pausado por 10 minutos');
    
    if (pauseTimeout) {
        clearTimeout(pauseTimeout);
    }
    
    pauseTimeout = setTimeout(() => {
        botActive = true;
        console.log('✅ Bot reativado automaticamente');
    }, PAUSE_DURATION);
}

// ✅ TODOS OS SERVIÇOS ORIGINAIS DA BARBEARIA
const services = [
    { name: "Barba", time: "20min", price: "a partir de R$ 20,00" },
    { name: "Barba na cera (designer)", time: "30min", price: "a partir de R$ 35,00" },
    { name: "Barba na cera (remoção total)", time: "40min", price: "a partir de R$ 50,00" },
    { name: "Corte de cabelo", time: "40min", price: "a partir de R$ 28,00" },
    { name: "Corte + barba + sobrancelha", time: "1h:10min", price: "a partir de R$ 55,00" },
    { name: "Corte + barba", time: "1h:00min", price: "a partir de R$ 45,00" },
    { name: "Depilação nasal", time: "15min", price: "a partir de R$ 15,00" },
    { name: "Hidratação + lavar", time: "10min", price: "a partir de R$ 15,00" },
    { name: "Luzes / reflexo", time: "1h:00min", price: "a partir de R$ 45,00" },
    { name: "Pigmentação cabelo ou barba", time: "15min", price: "a partir de R$ 18,00" },
    { name: "Platinado (nevou)", time: "1h:00min", price: "a partir de R$ 90,00" },
    { name: "Relaxamento", time: "20min", price: "a partir de R$ 35,00" },
    { name: "Sobrancelhas", time: "10min", price: "a partir de R$ 10,00" },
    { name: "Sobrancelhas na cera", time: "25min", price: "a partir de R$ 15,00" }
];

const address = "Av. Paulistana 2015, Natal, Rio Grande do Norte 59108120";
const operatingHours = "Seg a Sex: 09h as 19h\nSab: 09h as 16h";
const schedulingLink = "https://agendeonline.salonsoft.com.br/arretadobarbearia";

client.on('message', async msg => {
    try {
        // ✅ Verificar se bot está pausado manualmente
        if (global.botPaused) {
            console.log('🚫 Bot pausado manualmente - não processando mensagens');
            return;
        }
        
        // Verificar comandos de controle PRIMEIRO (aceita de qualquer número)
        if (msg.body === '!pausar') {
            console.log('🎯 COMANDO !pausar DETECTADO de:', msg.from);
            pauseBotForUserControl();
            await client.sendMessage(msg.from, '⏸️ Bot pausado por 10 minutos');
            return;
        }
        
        if (msg.body === '!ativar') {
            console.log('🎯 COMANDO !ativar DETECTADO de:', msg.from);
            botActive = true;
            if (pauseTimeout) {
                clearTimeout(pauseTimeout);
            }
            console.log('✅ Bot reativado manualmente');
            await client.sendMessage(msg.from, '▶️ Bot reativado');
            return;
        }
        
        if (msg.body === '!status') {
            console.log('🎯 COMANDO !status DETECTADO de:', msg.from);
            const status = botActive ? 'Ativo ✅' : 'Pausado ⏸️';
            await client.sendMessage(msg.from, `🤖 Status do bot: ${status}`);
            return;
        }
        
        // Se o bot estiver pausado, não processar mensagens de clientes
        if (!botActive) {
            console.log('🚫 Bot pausado - não processando mensagens');
            return;
        }

        console.log('📨 Processando mensagem:', msg.body, 'de:', msg.from);
        
        // Menu principal
        if (msg.body.match(/(menu|Menu|dia|tarde|noite|oi|Oi|Olá|olá|ola|Ola)/i) && msg.from.endsWith('@c.us')) {
            
            const chat = await msg.getChat();
            const contact = await msg.getContact();
            
            let name = "Cliente";
            try {
                if (contact.pushname && contact.pushname.trim() !== '') {
                    name = contact.pushname;
                } else if (contact.name && contact.name.trim() !== '') {
                    name = contact.name;
                } else {
                    const phoneNumber = msg.from.replace('@c.us', '');
                    name = `Cliente ${phoneNumber.slice(-4)}`;
                }
            } catch (error) {
                console.log('Erro ao capturar nome:', error);
                name = "Cliente";
            }
            
            await delay(1000);
            await chat.sendStateTyping();
            await delay(2000);

            const menuMessage = `Olá *${name.split(" ")[0]}*! 👋

Bem-vindo(a) à *Barbearia Arretado*! 💈

Como posso te ajudar hoje?

📋 *MENU PRINCIPAL:*

*1* - 📅 Marcar um horário
*2* - 💰 Nossos serviços  
*3* - 📍 Endereço e Horário

Digite o número da opção desejada!`;

            await client.sendMessage(msg.from, menuMessage);
        } 
        
        // Opção 1 - Marcar horário
        else if (msg.body === "1" || msg.body.toLowerCase().includes("marcar") || msg.body.toLowerCase().includes("horário")) {
            const chat = await msg.getChat();
            
            await delay(1000);
            await chat.sendStateTyping();
            await delay(2000);
            
            await client.sendMessage(msg.from, 
                `📅 *Agendamento Online*

Para marcar seu horário, acesse nosso sistema:
${schedulingLink}

✨ É rápido e fácil!
Esperamos por você! 💈`
            );
        } 
        
        // Opção 2 - Serviços
        else if (msg.body === "2" || msg.body.toLowerCase().includes("serviços") || msg.body.toLowerCase().includes("preços")) {
            const chat = await msg.getChat();
            
            await delay(1000);
            await chat.sendStateTyping();
            await delay(2000);
            
            let servicesList = "💰 *Confira nossos serviços e valores:*\n\n";
            services.forEach(service => {
                servicesList += `• ${service.name} (${service.time}): ${service.price}\n`;
            });
            servicesList += "\n📞 Estamos à disposição para qualquer dúvida!";
            
            await client.sendMessage(msg.from, servicesList);
        } 
        
        // Opção 3 - Endereço e horário
        else if (msg.body === "3" || msg.body.toLowerCase().includes("endereço") || msg.body.toLowerCase().includes("localização")) {
            const chat = await msg.getChat();
            
            await delay(1000);
            await chat.sendStateTyping();
            await delay(2000);
            
            await client.sendMessage(msg.from, 
                `📍 *Nossa Localização:*
${address}

🕒 *Horário de Funcionamento:*
${operatingHours}

Esperamos sua visita! 💈✨`
            );
        } 
        
        // Mensagem padrão
        else if (msg.from.endsWith('@c.us')) {
            const chat = await msg.getChat();
            
            await delay(1000);
            await chat.sendStateTyping();
            await delay(1500);
            
            await client.sendMessage(msg.from, 
                `Desculpe, não entendi sua mensagem. 😅

Digite *"menu"* para ver as opções disponíveis! 📋`
            );
        }
    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Tratamento de erros globais
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});
