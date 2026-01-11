// ================================================================= //
//                             IMPORTAÇÕES                           //
// ================================================================= //
const {
    Client, GatewayIntentBits, EmbedBuilder, Events, PermissionFlagsBits,
    SlashCommandBuilder, REST, Routes, ChannelType, Partials
} = require('discord.js');
const fs = require('fs').promises; // Usando a versão assíncrona
const path = require('path');
const { parseCelesteTime, formatCelesteTime, framesFromSeconds } = require('./utils');

// ================================================================= //
//                            CONFIGURAÇÃO                           //
// ================================================================= //
const { token, clientId, guildId } = require('./config.json');

// Constantes para fácil manutenção
const COMANDOS_PATH = path.join(__dirname, 'comandos.json');
const LOG_CHANNEL_ID = '1382731931883405424';
const CARGO_KICK_ID = '1401330736442638497';
const DEFAULT_EMBED_COLOR = '#0099ff';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
});

// ================================================================= //
//                       GERENCIAMENTO DE DADOS                      //
// ================================================================= //
let comandosCustomizados = {};
let aliasesMap = {};

// Gerenciador de estados para comandos interativos
const estados = {
    criandoComando: new Map(),
    editandoComando: new Map(),
    enviandoMensagem: new Map(),
    editandoMensagem: new Map(),
};

// Gerenciador de spam
const userImageTracker = new Map();
const TIME_WINDOW = 130 * 1000;
const IMAGE_THRESHOLD = 2;
const CHANNEL_THRESHOLD = 4;

// Funções para carregar e salvar comandos
async function carregarComandos() {
    try {
        // Usamos fs.access para checar se o arquivo existe de forma assíncrona
        await fs.access(COMANDOS_PATH);
        const data = await fs.readFile(COMANDOS_PATH, 'utf8');
        comandosCustomizados = JSON.parse(data);
        
        // Recria o mapa de aliases
        aliasesMap = {};
        for (const nome in comandosCustomizados) {
            const cmd = comandosCustomizados[nome];
            if (cmd.aliases && Array.isArray(cmd.aliases)) {
                for (const alias of cmd.aliases) {
                    aliasesMap[alias] = nome;
                }
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Arquivo comandos.json não encontrado, será criado um novo.');
        } else {
            console.error('❌ Erro ao carregar ou parsear comandos.json:', error);
        }
        comandosCustomizados = {};
        aliasesMap = {};
    }
}

async function salvarComandos() {
    try {
        await fs.writeFile(COMANDOS_PATH, JSON.stringify(comandosCustomizados, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar comandos.json:', error);
    }
}

// ================================================================= //
//                     REGISTRO DE SLASH COMMANDS                    //
// ================================================================= //
async function registrarSlashCommands() {
    console.log('🔄 Registrando slash commands...');
    const comandos = [
        new SlashCommandBuilder()
            .setName('comando')
            .setDescription('Gerencia comandos personalizados')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub =>
                sub.setName('criar')
                    .setDescription('Cria um comando personalizado')
                    .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true))
                    .addBooleanOption(opt => opt.setName('usar_embed').setDescription('Usar embed?').setRequired(true))
                    .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed (hex)').setRequired(false))
            )
            .addSubcommand(sub =>
                sub.setName('editar')
                    .setDescription('Edita um comando personalizado')
                    .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true))
                    .addStringOption(opt => opt.setName('cor').setDescription('Nova cor do embed (hex)').setRequired(false))
            )
            .addSubcommand(sub =>
                sub.setName('deletar')
                    .setDescription('Deleta um comando personalizado')
                    .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true))
            ),
        new SlashCommandBuilder()
            .setName('mensagem')
            .setDescription('Envia mensagem do bot')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption(opt => opt.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addBooleanOption(opt => opt.setName('usar_embed').setDescription('Enviar como embed?').setRequired(true))
            .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed (hex)').setRequired(false)),
        new SlashCommandBuilder()
            .setName('editarmensagem')
            .setDescription('Edita mensagem enviada pelo bot')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(opt => opt.setName('link').setDescription('Link da mensagem').setRequired(true))
            .addStringOption(opt => opt.setName('cor').setDescription('Nova cor do embed (hex)').setRequired(false)),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Lista os comandos de barra disponíveis (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('Envia uma DM para um ou mais usuários')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(opt => opt.setName('usuarios').setDescription('IDs ou menções dos usuários (separados por espaço)').setRequired(true))
            .addStringOption(opt => opt.setName('mensagem').setDescription('Mensagem para enviar').setRequired(true)),
        new SlashCommandBuilder()
            .setName('subcomando')
            .setDescription('Gerencia aliases (apelidos) de comandos')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub =>
                sub.setName('adicionar')
                    .setDescription('Adiciona um alias para um comando existente')
                    .addStringOption(opt => opt.setName('comando').setDescription('Comando principal').setRequired(true))
                    .addStringOption(opt => opt.setName('alias').setDescription('Novo alias').setRequired(true))
            )
            .addSubcommand(sub =>
                sub.setName('remover')
                    .setDescription('Remove um alias de um comando')
                    .addStringOption(opt => opt.setName('alias').setDescription('Alias para remover').setRequired(true))
            ),
    ];

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: comandos.map(c => c.toJSON())
        });
        console.log('✅ Slash commands registrados com sucesso.');
    } catch (error) {
        console.error('❌ Falha ao registrar slash commands:', error);
    }
}

// ================================================================= //
//                         FUNÇÕES UTILITÁRIAS                       //
// ================================================================= //
function formatarCor(corInput) {
    if (!corInput) return DEFAULT_EMBED_COLOR;
    const corLimpa = corInput.startsWith('#') ? corInput.substring(1) : corInput;
    if (/^[0-9A-F]{6}$/i.test(corLimpa)) {
        return `#${corLimpa.toUpperCase()}`;
    }
    return DEFAULT_EMBED_COLOR;
}

async function getLogChannel() {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (channel && channel.isTextBased()) return channel;
    } catch (error) {
        console.error(`⚠️ Canal de log com ID ${LOG_CHANNEL_ID} não encontrado.`);
    }
    return null;
}

// ================================================================= //
//                           EVENTO: READY                           //
// ================================================================= //
client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}, V0.10`);
    await carregarComandos();
    await registrarSlashCommands();

    try {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.fetch();
        console.log('✅ Membros do servidor carregados para cache.');
    } catch (err) {
        console.error('❌ Erro ao carregar membros do servidor:', err);
    }
});

// ================================================================= //
//                       EVENTO: MESSAGE CREATE                      //
// ================================================================= //
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        const logChannel = await getLogChannel();
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('Mensagem recebida em DM')
            .setDescription(message.content || '*Sem texto*')
            .setAuthor({ name: `${message.author.tag} (${message.author.id})`, iconURL: message.author.displayAvatarURL() })
            .setColor(DEFAULT_EMBED_COLOR)
            .setTimestamp();
        if (message.attachments.first()?.url) {
            embed.setImage(message.attachments.first().url);
        }
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error('❌ Erro ao enviar log de DM:', err);
        }
        return;
    }

    if (!message.guild) return;
    
    const userId = message.author.id;
    const imageURL = message.attachments.first()?.url ?? null;
    const conteudo = message.content.trim();
    
    // --- Lógica de Estados (Comandos Interativos) ---
    if (estados.criandoComando.has(userId)) {
        const { nome, usarEmbed, cor } = estados.criandoComando.get(userId);
        if (!conteudo && !imageURL) return message.reply('Envie uma mensagem ou anexe uma imagem para o comando.');
        
        comandosCustomizados[nome] = { mensagem: conteudo || imageURL, embed: usarEmbed, cor };
        await salvarComandos();
        estados.criandoComando.delete(userId);
        return message.reply(`Comando \`!${nome}\` criado.`);
    }
    if (estados.editandoComando.has(userId)) {
        const { nome } = estados.editandoComando.get(userId);
        if (!conteudo && !imageURL) return message.reply('Envie uma mensagem ou anexe uma imagem para o comando.');

        comandosCustomizados[nome].mensagem = conteudo || imageURL;
        await salvarComandos();
        estados.editandoComando.delete(userId);
        return message.reply('Comando editado.');
    }
    if (estados.enviandoMensagem.has(userId)) {
        const { canalId, usarEmbed, cor } = estados.enviandoMensagem.get(userId);
        const canal = message.guild.channels.cache.get(canalId);
        if (!canal) return message.reply('Canal inválido.');

        if (usarEmbed) {
            const embed = new EmbedBuilder().setDescription(conteudo).setColor(cor);
            if (imageURL) embed.setImage(imageURL);
            await canal.send({ embeds: [embed] });
        } else {
            await canal.send({ content: conteudo, files: imageURL ? [imageURL] : [] });
        }
        estados.enviandoMensagem.delete(userId);
        return message.reply('Mensagem enviada.');
    }
    if (estados.editandoMensagem.has(userId)) {
        const { channelId, messageId, novaCor } = estados.editandoMensagem.get(userId);
        const canal = message.guild.channels.cache.get(channelId);
        if (!canal) return message.reply('Canal inválido.');

        try {
            const targetMsg = await canal.messages.fetch(messageId);
            const corOriginal = targetMsg.embeds?.[0]?.color ? '#' + targetMsg.embeds[0].color.toString(16).padStart(6, '0') : DEFAULT_EMBED_COLOR;

            const embed = new EmbedBuilder().setDescription(conteudo).setColor(novaCor || corOriginal);
            if (imageURL) embed.setImage(imageURL);

            await targetMsg.edit({ content: '', embeds: [embed] });
            estados.editandoMensagem.delete(userId);
            return message.reply('Mensagem editada.');
        } catch {
            estados.editandoMensagem.delete(userId);
            return message.reply('Mensagem não encontrada.');
        }
    }

    // --- Lógica de Comandos com Prefixo `!` ---
    if (conteudo.startsWith('!')) {
        const args = conteudo.slice(1).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        
        // Comandos Especiais (Hardcoded)
        if (commandName === 'ajuda') {
            const descricoes = {
                somartempo: 'Soma vários tempos no formato Celeste (ex: !somartempo 1:00:16.257 58:43.930).',
                comparartempo: 'Subtrai dois tempos Celeste (ex: !comparartempo 1:00:16.257 58:43.930).',
                validartempo: 'Verifica se um tempo é um frame válido (ex: !validartempo 1.700).',
                regra: 'Mostra regras específicas do servidor (ex: !regra 1).',
            };
            if (args.length > 0) {
                const nomeCmd = args[0].toLowerCase();
                if (descricoes[nomeCmd]) return message.reply(`**!${nomeCmd}**: ${descricoes[nomeCmd]}`);
                return message.reply('❌ Comando não encontrado. Use !ajuda para ver a lista.');
            }
            const comandosRegra = Object.keys(comandosCustomizados).filter(n => n.startsWith('regra')).length > 0;
            const outrosComandos = Object.keys(comandosCustomizados).filter(n => !n.startsWith('regra') && !comandosCustomizados[n].isAlias);
            let lista = [];
            if(comandosRegra) lista.push('!regra X');
            lista.push(...outrosComandos.map(n => `!${n}`));
            lista.push('!somartempo', '!comparartempo', '!validartempo');
            
            return message.reply(`**Comandos disponíveis:**\n${lista.join(' // ')}\n\nDigite \`!ajuda [comando]\` para mais detalhes.`);
        }
        else if (commandName === 'validartempo' || commandName === 'validarframe') {
             if (args.length < 1) return message.reply('❌ Use: !validartempo <tempo>');
             const tempo = parseCelesteTime(args[0]);
             if (tempo === null) return message.reply('❌ Tempo inválido.');
             
             const frames = tempo / 0.017;
             const framesRounded = Math.round(frames);
             const tempoFrame = framesRounded * 0.017;
             if (Math.abs(tempo - tempoFrame) < 0.0005) {
                 return message.reply(`✅ Frame válido! (${framesRounded}f)`);
             } else {
                 let lowerTime = (Math.floor(frames) * 0.017);
                 let upperTime = (Math.ceil(frames) * 0.017);

                 const lowerTimeF = formatCelesteTime(lowerTime);
                 const upperTimeF = formatCelesteTime(upperTime);

                 return message.reply(`❌ Frame inválido!\nFrames mais próximos: \`-${lowerTimeF}\` e \`+${upperTimeF}\``);
             }
        }
        else if (commandName === 'comparartempo') {
             if (args.length < 2) return message.reply('❌ Use: !comparartempo <tempo1> <tempo2>');
             const t1 = parseCelesteTime(args[0]);
             const t2 = parseCelesteTime(args[1]);
             if (t1 === null || t2 === null) return message.reply('❌ Um dos tempos é inválido.');
             
             const f1 = framesFromSeconds(t1);
             const f2 = framesFromSeconds(t2);
             const diffFrames = f1 - f2;
             const diffSeconds = Math.abs(diffFrames) * 0.017;
             const sign = diffFrames >= 0 ? '' : '-';
             return message.reply(`➡️ ${formatCelesteTime(t1)} (${f1}f) - ${formatCelesteTime(t2)} (${f2}f) = ${sign}${formatCelesteTime(diffSeconds)} (${Math.abs(diffFrames)}f)`);
        }
        else if (commandName === 'somartempo') {
            if (args.length < 2) return message.reply('❌ Use: !somartempo <tempo1> <tempo2> ...');
            let total = 0;
            for (const arg of args) {
                const t = parseCelesteTime(arg);
                if (t === null) return message.reply(`❌ Tempo inválido: \`${arg}\`.`);
                total += t;
            }
            return message.reply(`A soma dos tempos é: **${formatCelesteTime(total)}** (${framesFromSeconds(total)}f)`);
        }
        // Comandos Customizados
        else {
            const fullCommandName = conteudo.slice(1).toLowerCase();
            const nomeFinal = aliasesMap[fullCommandName] || fullCommandName;
            const cmd = comandosCustomizados[nomeFinal];

            if (cmd) {
                if (cmd.embed) {
                    const embed = new EmbedBuilder().setColor(cmd.cor || DEFAULT_EMBED_COLOR);
                    // Checa se a mensagem é uma URL de imagem válida
                    if (/\.(jpeg|jpg|gif|png)$/i.test(cmd.mensagem)) {
                        embed.setImage(cmd.mensagem);
                    } else {
                        embed.setDescription(cmd.mensagem);
                    }
                    return message.channel.send({ embeds: [embed] });
                } else {
                    return message.channel.send(cmd.mensagem);
                }
            }
        }
    }
    
    // --- Lógica de Anti-Spam de Imagens ---
    const imageAttachments = message.attachments.filter(att => {
        const isContentTypeImage = att.contentType?.startsWith('image/');
        const nameOrUrl = (att.name || att.url || '').toLowerCase();
        const isExtensionImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(nameOrUrl);
        return isContentTypeImage || isExtensionImage;
    });
    if (imageAttachments.size > 0) {
        if (!userImageTracker.has(userId)) {
            const timer = setTimeout(() => userImageTracker.delete(userId), TIME_WINDOW);
            // Conta todas as imagens da primeira mensagem corretamente
            userImageTracker.set(userId, { count: imageAttachments.size, channels: new Set([message.channel.id]), timer });
        } else {
            const userData = userImageTracker.get(userId);
            userData.count += imageAttachments.size; // Conta todas as imagens na mensagem
            userData.channels.add(message.channel.id);

            // Renova o timer para implementar janela deslizante
            clearTimeout(userData.timer);
            userData.timer = setTimeout(() => userImageTracker.delete(userId), TIME_WINDOW);

            if (userData.count >= IMAGE_THRESHOLD && userData.channels.size >= CHANNEL_THRESHOLD) {
                clearTimeout(userData.timer);
                userImageTracker.delete(userId);

                const member = message.member;
                if (member && member.bannable) {
                    try {
                        await member.ban({
                            deleteMessageSeconds: 3600,
                            reason: `Spam de imagens (${userData.count} em ${userData.channels.size} canais).`
                        });
                        console.log(`✅ Usuário ${message.author.tag} banido por spam.`);

                        try {
                            await message.guild.bans.remove(userId, 'Fim do soft-ban (spam de imagens)');
                            console.log(`✅ Usuário ${message.author.tag} desbanido (spam de imagens).`);
                        } catch (err) {
                            console.error('❌ Falha ao remover ban:', err);
                        }

                        await sendLogSpam(member, userData, false);

                        try {
                            const targetUser = await client.users.fetch(id);
                            await targetUser.send(mensagem);
                            sucesso++;
                        } catch {
                            falha++;
                        }

                        logChannel.send
                    } catch (error) {
                        console.error(`❌ Falha ao banir ${message.author.tag}:`, error);
                        await sendLogSpam(member, userData, true);
                    }
                } else {
                    console.log(`⚠️ Não foi possível banir ${message.author.tag} (permissões insuficientes).`);
                    // Garante objeto compatível para sendLogSpam se member for undefined
                    const pseudoMember = member || { user: message.author, id: message.author.id, displayAvatarURL: () => message.author.displayAvatarURL?.() };
                    await sendLogSpam(pseudoMember, userData, true);
                }
            }
        }
    }
});

// ================================================================= //
//                     EVENTO: INTERACTION CREATE                    //
// ================================================================= //
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Apenas administradores podem usar esse comando.', ephemeral: false });
    }

    const { commandName, options, user, guild } = interaction;
    const userId = user.id;

    if (commandName === 'comando') {
        const sub = options.getSubcommand();
        const nome = options.getString('nome').toLowerCase();

        if (sub === 'criar') {
            if (comandosCustomizados[nome] || aliasesMap[nome]) {
                return interaction.reply({ content: '❌ Um comando ou alias com esse nome já existe.', ephemeral: false });
            }
            const usarEmbed = options.getBoolean('usar_embed');
            const cor = formatarCor(options.getString('cor'));
            estados.criandoComando.set(userId, { nome, usarEmbed, cor });
            return interaction.reply({ content: `✅ Envie agora o conteúdo para o comando \`!${nome}\`. Você pode anexar uma imagem.`, ephemeral: false });
        }
        if (sub === 'editar') {
            if (!comandosCustomizados[nome]) {
                return interaction.reply({ content: '❌ Comando não existe.', ephemeral: false });
            }
            const novaCor = options.getString('cor');
            if (novaCor) {
                comandosCustomizados[nome].cor = formatarCor(novaCor);
                await salvarComandos();
            }
            estados.editandoComando.set(userId, { nome });
            return interaction.reply({ content: `✏️ Envie agora o novo conteúdo para \`!${nome}\`.${novaCor ? `\nCor atualizada.` : ''}`, ephemeral: false });
        }
        if (sub === 'deletar') {
            if (!comandosCustomizados[nome]) {
                return interaction.reply({ content: '❌ Comando não existe.', ephemeral: false });
            }
            if (comandosCustomizados[nome].aliases) {
                for (const alias of comandosCustomizados[nome].aliases) {
                    delete aliasesMap[alias];
                }
            }
            delete comandosCustomizados[nome];
            await salvarComandos();
            return interaction.reply({ content: `✅ Comando \`!${nome}\` deletado com sucesso.`, ephemeral: false });
        }
    }

    if (commandName === 'subcomando') {
        const sub = options.getSubcommand();
        const alias = options.getString('alias').toLowerCase();

        if (sub === 'adicionar') {
            const comando = options.getString('comando').toLowerCase();
            if (!comandosCustomizados[comando]) return interaction.reply({ content: '❌ Comando principal não existe.', ephemeral: false });
            if (comandosCustomizados[alias] || aliasesMap[alias]) return interaction.reply({ content: '❌ Um comando ou alias com esse nome já existe.', ephemeral: false });
            
            comandosCustomizados[comando].aliases = comandosCustomizados[comando].aliases || [];
            comandosCustomizados[comando].aliases.push(alias);
            aliasesMap[alias] = comando;
            await salvarComandos();
            return interaction.reply({ content: `✅ Alias \`!${alias}\` adicionado para \`!${comando}\`.`, ephemeral: false });
        }
        if (sub === 'remover') {
            const comandoOriginal = aliasesMap[alias];
            if (!comandoOriginal || !comandosCustomizados[comandoOriginal]) return interaction.reply({ content: '❌ Alias não encontrado.', ephemeral: false });

            comandosCustomizados[comandoOriginal].aliases = comandosCustomizados[comandoOriginal].aliases.filter(a => a !== alias);
            delete aliasesMap[alias];
            await salvarComandos();
            return interaction.reply({ content: `✅ Alias \`!${alias}\` removido.`, ephemeral: false });
        }
    }

    if (commandName === 'help') {
        const commandList = [
            '/comando criar', '/comando editar', '/comando deletar',
            '/subcomando adicionar', '/subcomando remover',
            '/mensagem', '/editarmensagem', '/dm', '/help'
        ].map(c => `• ${c}`).join('\n');
        return interaction.reply({ content: `📋 Comandos de admin:\n${commandList}`, ephemeral: false });
    }

    if (commandName === 'mensagem') {
        const canal = options.getChannel('canal');
        const usarEmbed = options.getBoolean('usar_embed');
        const cor = formatarCor(options.getString('cor'));
        estados.enviandoMensagem.set(userId, { canalId: canal.id, usarEmbed, cor });
        return interaction.reply({ content: `✅ Envie agora a mensagem para o canal ${canal}.`, ephemeral: false });
    }

    if (commandName === 'editarmensagem') {
        const link = options.getString('link');
        const match = link.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
        if (!match || match[1] !== guild.id) return interaction.reply({ content: '❌ Link inválido ou de outro servidor.', ephemeral: false });
        
        const [, , channelId, messageId] = match;
        const novaCor = options.getString('cor') ? formatarCor(options.getString('cor')) : null;
        estados.editandoMensagem.set(userId, { channelId, messageId, novaCor });
        return interaction.reply({ content: `✅ Envie agora o novo conteúdo para a mensagem.`, ephemeral: false });
    }
    
    if (commandName === 'dm') {
        const usuariosInput = options.getString('usuarios');
        const mensagem = options.getString('mensagem');
        const ids = usuariosInput.match(/\d{17,19}/g) || [];
        let sucesso = 0;
        let falha = 0;

        for (const id of ids) {
            try {
                const targetUser = await client.users.fetch(id);
                await targetUser.send(mensagem);
                sucesso++;
            } catch {
                falha++;
            }
        }
        return interaction.reply({ content: `✅ DM enviada para ${sucesso} usuário(s). Falha para ${falha}.`, ephemeral: false });
    }
});

async function sendLogSpam(member, userData, errorOccurred) {
    const logChannel = await getLogChannel();
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
        
    if(errorOccurred) {
        embed.setTitle('Falha na Punição Automática')
             .setDescription(`**Não foi possível banir:** ${member.user}`)
             .addFields({ name: 'Motivo da Falha', value: 'Permissões insuficientes.' });
    } else {
        embed.setTitle('Punição Automática')
             .setDescription(`**Usuário banido:** ${member.user}`)
             .addFields(
                { name: 'Motivo', value: 'Muitos anexos em pouco tempo', inline: true },
                { name: 'Detalhes', value: `${userData.count} anexos em ${userData.channels.size} canais.`, inline: true }
             );
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Falha ao enviar a mensagem de log de spam:', error);
    }
}

// ================================================================= //
//                          INICIALIZAÇÃO                            //
// ================================================================= //
client.login(token);
