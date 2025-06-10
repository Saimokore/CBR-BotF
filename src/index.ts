const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token } = require('../config.json');

// Atualize os intents para permitir leitura de mensagens
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.login(token);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.channel.send('Pong!');
    } else if (message.content === '!help') {
        message.channel.send('Comandos disponíveis: !ping, !regra X');
    } else if (message.content.toLowerCase().startsWith('!regra ')) {
        const numero = message.content.split(' ')[1];
        const regras = [
            "**Respeito com os membros**\nTenha respeito com todos os membros do servidor, da mesma forma como gostaria que lhe tratassem. Isso inclui respeito à equipe e ADMs do server.",
            "**Preconceitos de qualquer tipo não serão tolerados**\nQualquer uso de agressividade, desrespeito ou má fé nesse servidor NÃO SÃO TOLERADOS. Atenha-se ao uso correto de pronomes, identidade de gênero, idade, etnia, preferências, gostos pessoais etc.\nIsso inclui qualquer conteúdo desrespeitoso, preconceituoso, transfóbico, inapropriado ou ofensivo na seção de pronomes, foto de perfil, nome de usuário e conteúdo da bio de qualquer pessoa. Tentativas de apelo ao ban também não serão aceitas.",
            "**Evite assuntos polêmicos, desnecessários e inapropriados**\nSem conteúdo +18, gore, NSFW, NSFL, ou assuntos políticos, polarizantes ou polêmicos. Veja que assuntos delicados relacionados a Celeste ainda são permitidos, tais como identidade de gênero ou ansidedade/depressão, mas tenha respeito ao lidar com tais assuntos.",
            "**Mantenha o propósito dos chats**\nAtenha-se ao propósito de cada um do chats do servidor e de seu respectivo chat. As descrições do canal contém seu propósito. Para assuntos não-relacionados a celeste, dirija-se ao ⁠offtopic.",
            "**Proibido spam**\nNão polua os canais do servidor com conteúdo repetitivo e/ou de baixa qualidade. Caso queira postar memes, faça-o no ⁠offtopic e em pouca frequência.",
            "**Divulgação no ⁠divulgação**\nApenas divulgue seus canais e projetos no canal ⁠divulgação. Ele tem preferência a divulgação relacionado a Celeste, mas também suporta divulgações externas, a depender de seu conteúdo. Não spamme divulgação não-relacionado excessivas vezes.",
            "**Evite o uso de alts**\nContas alternativas podem ocasionalmente serem úteis ou necessárias, especialmente como microfones na ausência de equipamento apropriado. Mas é mandatório informar aos moderadores que a sua conta é alternativa, a quem ela pertence, e qual o seu propósito. Aqueles que não informarem serão removidos. Considerem também que punições à conta principal aplicam igualmente às contas alternativas, e vice-versa.",
            "**Proibido personificação**\nSe passar por outras pessoas (sendo elas ou não jogadoras de Celeste ou membros desta comunidade) é proibido, assim como personificações de qualquer espécie ou tentativas intencionais e injustificáveis de ocultar a própria identidade. Fingir ser inexperiente ou ter entrado recentemente no server não será tolerado. Brincadeiras envolvendo se passar por outras pessoas ou fazer roleplay também não serão toleradas.",
            "**Não seja extremamente negativo ou expositivo**\nNão seja extremamente negativo. O servidor de Celeste não é um local apropriado para venting ou exposição exagerada.\nCaso tenha ideações ou intenções suicidas, procure o Centro de Assistência Psicossocial mais próximo de você, ou entre em contato com o CVV mais próximo de você, através deste site ou as alternativas internacionais.",
            "**Proibido menores de idade ligarem suas câmeras ou se exporem**\nNão toleramos que jovens com menos de 18 anos que se exponham de qualquer forma visando sua segurança. Jamais se exponham na internet.",
            "**Jamais rebaixe, pressione ou desqualifique as conquistas de terceiros**\nTal como sugere o título, não desmereça a conquista de ninguém. Sempre procure incentivar e parabenizar o melhor dos outros sem crítica ou pressão. Evite comentários como \"achei o tempo ruim\"; \"agora pegue golden de X\"; \"quando vai sair o SUB X?\", etc.",
            "**Idioma**\nA Celeste Brasil utiliza o português como a língua oficial, e, embora sejamos tolerantes ao uso de outras línguas; não insista em conversar em outras línguas ou engaje em conversas utilizando códigos, línguas, ou sistemas de comunicação estranhas. Falar em línguas não-identificáveis dificulta a moderação e deve ser evitado sempre que possível.",
            "**Uso de materiais, arte ou créditos**\nToda vez que for postar material externo ao servidor, como artes, livros, séries e obras em geral, sempre credite o artista por trás e nunca compartilhe material sem a expressa autorização do criador. Não toleramos uso de artes geradas por Inteligência Artificial.\nCaso for gravar qualquer material dentro do server, peça a autorização e consentimento expresso de TODOS os participantes presentes ou envolvidos a qualquer momento da gravação. Se estiver gravando uma chamada, utilize o status da chamada e altere-a para \"GRAVANDO 🔴\" ou qualquer status similar.",
            "**Respeito à equipe**\nVocê possui todo o direito de discordar das ações dos administradores do servidor, mas entenda que os Administradores são pessoas como você, também tem sentimentos, e trabalham intensamente para manter a comunidade. Caso tenha questões com a equipe ou com um em específico, converse conosco pela DM ou abra um ticket expressando sua preocupação.\nPingar a role @Adminㅤ sem a expressa razão de chamar a atenção dos moderadores pra algo urgente ou necessário resultará em um Timeout de 7 dias. Ofensas repetidas ou pings feitos em consequência de \"brincadeiras\" ou outras motivações fúteis estarão sujeitos a punições maiores e Avisos Oficiais.\nBloquear administradores do servidor não será tolerado. Isso impossibilita a comunicação sobre assuntos relativos ao servidor e dificulta nosso trabalho de moderação.",
            "**Conformidade aos Termos de Serviço**\nNós agimos em conformidade aos Termos de Serviço do Discord. Usuários encontrados em flagrante violação ao TOS serão prontamente removidos do servidor.",
            "**Sugestões ao servidor**\nCaso você tenha sugestões ao servidor, pingue um dos ADMs informando sua ideia que observaremos com calma discutiremos entre a equipe para avaliar a mudança. Não pressione ou faça as mesmas sugestões várias vezes.",
            "**Apelo à pena**\nVocê pode apelar sua pena entrando em contato com qualquer um dos administradores. Caso a decisão tenha sido tomada, ela é final.",
            "**Denúncias**\nVocê pode denunciar quaisquer comportamentos ou ações desse servidor que agrediram a você ou a um colega abrindo um ticket pelo botão abaixo. Você pode também anonimamente entrar em contato conosco por esse link.\nAbusos flagrantes das ferramentas de comunicação com os mods, como uso para trotes, brincadeiras, spam, ou assédio de qualquer espécie, estarão sujeitos a punições. A comunicação com os moderadores através dos tickets e do formulário anônimo deve respeitar todas as regras do servidor."
        ];
        const idx = parseInt(numero) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < regras.length) {
            const embed = new EmbedBuilder()
                .setTitle(`Regra ${numero}`)
                .setDescription(regras[idx])
                .setColor(0x0099ff);
            message.channel.send({ embeds: [embed] });
        } else {
            message.channel.send('Por favor, informe um número de 1 a 18. Exemplo: !regra 3');
        }
    } else if (message.content === '!subhora') {
        message.channel.send('Comandos disponíveis: !ping, !regra X');
    } else if (message.content === '!sub40') {
        message.channel.send('Comandos disponíveis: !ping, !regra X');
    } else if (message.content === '!sub30') {
        message.channel.send('Comandos disponíveis: !ping, !regra X');
    } else if (message.content === '!girias') {
        message.channel.send('Comandos disponíveis: !ping, !regra X');
    }
});

// Armazena comandos customizados temporariamente (memória RAM)
const customCommands: {
    [key: string]: { response?: string; embed?: { title: string; description: string; color: number } }
} = {};

// Função para verificar se o usuário tem cargo de moderador
function isModerator(member) {
    return member.roles.cache.some(role =>
        ['moderador', 'moderator', 'mod'].includes(role.name.toLowerCase())
    );
}

client.on('messageCreate', async message => {
    // Comando para criar comandos customizados (apenas moderadores)
    if (message.content.startsWith('!criarcomando ')) {
        if (!isModerator(message.member)) {
            message.channel.send('Apenas moderadores podem criar comandos.');
            return;
        }

        // Sintaxe: !criarcomando nome resposta
        // Ou: !criarcomando nome embed "Título" "Descrição" #RRGGBB
        const args = message.content.slice('!criarcomando '.length).trim().split(' ');
        const commandName = args.shift();
        if (!commandName) {
            message.channel.send('Uso: !criarcomando nome resposta\nOu: !criarcomando nome embed "Título" "Descrição" #RRGGBB');
            return;
        }

        if (args[0] === 'embed') {
            // Exemplo: !criarcomando aviso embed "Título" "Descrição" #FF0000
            const match = message.content.match(/!criarcomando\s+(\S+)\s+embed\s+"([^"]+)"\s+"([^"]+)"\s+(#[0-9a-fA-F]{6})/);
            if (!match) {
                message.channel.send('Uso: !criarcomando nome embed "Título" "Descrição" #RRGGBB');
                return;
            }
            const [, , title, description, colorHex] = match;
            const color = parseInt(colorHex.replace('#', ''), 16);
            customCommands[commandName] = {
                embed: { title, description, color }
            };
            message.channel.send(`Comando embed !${commandName} criado com sucesso!`);
        } else {
            // Comando simples de texto
            const commandResponse = args.join(' ');
            if (!commandResponse) {
                message.channel.send('Uso: !criarcomando nome resposta');
                return;
            }
            customCommands[commandName] = { response: commandResponse };
            message.channel.send(`Comando !${commandName} criado com sucesso!`);
        }
        return;
    }

    // Executa comandos customizados
    if (message.content.startsWith('!')) {
        const cmd = message.content.slice(1).split(' ')[0];
        if (customCommands[cmd]) {
            if (customCommands[cmd].embed) {
                const { title, description, color } = customCommands[cmd].embed!;
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color);
                message.channel.send({ embeds: [embed] });
            } else if (customCommands[cmd].response) {
                message.channel.send(customCommands[cmd].response!);
            }
        }
    }
});