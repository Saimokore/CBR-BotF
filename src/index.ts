// index.ts corrigido com suporte garantido a DMs desde o início

const {
  Client, GatewayIntentBits, EmbedBuilder, Events, PermissionFlagsBits,
  SlashCommandBuilder, REST, Routes, ChannelType, Partials
} = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
const fs = require('fs');
const path = require('path');

const comandosPath = path.join(__dirname, 'comandos.json');
let comandosCustomizados = {};
if (fs.existsSync(comandosPath)) {
  comandosCustomizados = JSON.parse(fs.readFileSync(comandosPath, 'utf8'));
}

// Adicione esta linha para criar o aliasesMap:
let aliasesMap = {};
for (const nome in comandosCustomizados) {
  const cmd = comandosCustomizados[nome];
  if (cmd.aliases && Array.isArray(cmd.aliases)) {
    for (const alias of cmd.aliases) {
      aliasesMap[alias] = nome;
    }
  }
}

function salvarComandos() {
  fs.writeFileSync(comandosPath, JSON.stringify(comandosCustomizados, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

console.log('Bot está iniciando...'); // Adicione esta linha

const estados = {
  criandoComando: new Map(),
  editandoComando: new Map(),
  enviandoMensagem: new Map(),
  editandoMensagem: new Map(),
};

async function registrarComandos() {
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
      .setDescription('Envia uma DM para um ou mais usuários (separe por espaço ou vírgula)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('usuarios').setDescription('IDs ou menções dos usuários').setRequired(true))
      .addStringOption(opt => opt.setName('mensagem').setDescription('Mensagem para enviar').setRequired(true)),

    new SlashCommandBuilder()
      .setName('subcomando')
      .setDescription('Gerencia aliases de comandos')
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
          .addStringOption(opt => opt.setName('comando').setDescription('Comando principal').setRequired(true))
          .addStringOption(opt => opt.setName('alias').setDescription('Alias para remover').setRequired(true))
      ),
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: comandos.map(c => c.toJSON())
  });
}

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  await registrarComandos();

  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.fetch();
    console.log('✅ Membros do servidor carregados para cache.');
  } catch (err) {
    console.error('Erro ao carregar membros do servidor:', err);
  }
});

client.on('messageCreate', async message => {
  const userId = message.author.id;

  if (message.partial) await message.fetch();
  if (message.channel.partial) await message.channel.fetch();
  if (message.author.bot) return;

  if (message.channel.type === ChannelType.DM) {
    console.log(`✅ DM recebida de ${message.author.tag}: ${message.content || '[Sem conteúdo]'}`);

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const logChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && (c.name === 'bot-log' || c.id === '1382731931883405424')
    );

    if (!logChannel || !logChannel.isTextBased()) {
      console.log('⚠️ Canal de log não encontrado ou inválido.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Mensagem recebida em DM')
      .setDescription(message.content || '*Sem texto*')
      .addFields({ name: 'Usuário', value: `${message.author.tag} (<@${message.author.id}>)` })
      .setColor('#0099ff')
      .setTimestamp();

    const image = message.attachments.first()?.url;
    if (image) embed.setImage(image);

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Erro ao enviar log de DM:', err);
    }

    return;
  }

  const getImageURL = () => message.attachments.first()?.url ?? null;

  // Estados de criação de comando
  if (estados.criandoComando.has(userId)) {
    const { nome, usarEmbed, cor } = estados.criandoComando.get(userId);
    const image = getImageURL();
    const conteudo = message.content.trim();

    if (!conteudo && !image) {
      return message.reply('Envie uma mensagem ou anexe uma imagem para o comando.');
    }

    comandosCustomizados[nome] = {
      mensagem: conteudo || image,
      embed: usarEmbed,
      cor
    };
    salvarComandos();
    estados.criandoComando.delete(userId);
    return message.reply(`Comando !${nome} criado.`);
  }

  // Estados de edição de comando
  if (estados.editandoComando.has(userId)) {
    const { nome } = estados.editandoComando.get(userId);
    const image = getImageURL();
    const conteudo = message.content.trim();

    if (!conteudo && !image) {
      return message.reply('Envie uma mensagem ou anexe uma imagem para o comando.');
    }

    comandosCustomizados[nome].mensagem = conteudo || image;
    salvarComandos();
    estados.editandoComando.delete(userId);
    return message.reply('Comando editado.');
  }

  // Estado enviando mensagem via /mensagem
  if (estados.enviandoMensagem.has(userId)) {
    const { canalId, usarEmbed, cor } = estados.enviandoMensagem.get(userId);
    const canal = message.guild.channels.cache.get(canalId);
    if (!canal) return message.reply('Canal inválido.');

    const image = getImageURL();
    if (usarEmbed) {
      const embed = new EmbedBuilder()
        .setDescription(message.content)
        .setColor(cor || '#0099ff');
      if (image) embed.setImage(image);
      await canal.send({ embeds: [embed] });
    } else {
      if (image) {
        await canal.send({ content: message.content, files: [image] });
      } else {
        await canal.send(message.content);
      }
    }
    estados.enviandoMensagem.delete(userId);
    return message.reply('Mensagem enviada.');
  }

  // Estado editando mensagem via /editarmensagem
  if (estados.editandoMensagem.has(userId)) {
    const { channelId, messageId, novaCor } = estados.editandoMensagem.get(userId);
    const canal = message.guild.channels.cache.get(channelId);
    if (!canal) return message.reply('Canal inválido.');

    let targetMsg;
    try {
      targetMsg = await canal.messages.fetch(messageId);
    } catch {
      estados.editandoMensagem.delete(userId);
      return message.reply('Mensagem não encontrada.');
    }

    const image = getImageURL();
    // Tenta pegar a cor original do embed, se existir
    let corOriginal = '#0099ff';
    if (targetMsg.embeds?.[0]?.color) {
      // O color do embed do discord.js v14 é decimal, precisa converter para hex
      corOriginal = '#' + targetMsg.embeds[0].color.toString(16).padStart(6, '0');
    }

    const embed = new EmbedBuilder()
      .setDescription(message.content)
      .setColor(novaCor || corOriginal);
    if (image) embed.setImage(image);

    await targetMsg.edit({ embeds: [embed] });
    estados.editandoMensagem.delete(userId);
    return message.reply('Mensagem editada.');
  }

  // Comando !ajuda para qualquer membro listar comandos customizados
  if (message.content.trim().toLowerCase().startsWith('!ajuda')) {
    const args = message.content.trim().split(/\s+/);
    // Descrições dos comandos
    const descricoes = {
      somartempo: 'Soma vários tempos no formato Celeste (ex: !somartempo 1:00:16.257 58:43.930 8:16.257).',
      comparartempo: 'Subtrai dois tempos Celeste e mostra a diferença em tempo e frames (ex: !comparartempo 1:00:16.257 58:43.930).',
      validartempo: 'Verifica se um tempo é válido (múltiplo de 0.017) e mostra os frames mais próximos (ex: !validartempo 1.700).',
      regra: 'Mostra regras específicas do servidor.',
    };

    if (args.length === 2) {
      const nomeCmd = args[1].toLowerCase();
      if (descricoes[nomeCmd]) {
        return message.reply(`**!${nomeCmd}**: ${descricoes[nomeCmd]}`);
      } else {
        return message.reply('❌ Comando não encontrado. Use !ajuda para ver a lista.');
      }
    }

    const nomes = Object.keys(comandosCustomizados);
    // Filtra comandos que NÃO são aliases
    const nomesSemAlias = nomes.filter(n =>
      !comandosCustomizados[n].aliases ||
      !Array.isArray(comandosCustomizados[n].aliases) ||
      comandosCustomizados[n].aliases.length === 0
    );
    // Filtra comandos que começam com "regra"
    const comandosRegra = nomesSemAlias.filter(n => n.startsWith('regra'));
    const outrosComandos = nomesSemAlias.filter(n => !n.startsWith('regra'));

    let lista = '';
    if (comandosRegra.length > 0) {
      lista += '!regra X';
      if (outrosComandos.length > 0) lista += ' // ';
    }
    lista += outrosComandos.map(n => `!${n}`).join(' // ');

    // Adiciona comandos de tempo
    const comandosTempo = ['!somartempo', '!comparartempo', '!validartempo'];
    if (lista) lista += ' // ';
    lista += comandosTempo.join(' // ');

    return message.reply(`**Comandos disponíveis:**\n${lista}\n\nDigite \`!ajuda [comando]\` para ver a descrição de um comando.`);
  }

  // Executar comandos customizados (!nome)
  if (message.content.startsWith('!')) {
    let nome = message.content.slice(1).toLowerCase();
    // Se for alias, pega o comando original
    if (aliasesMap[nome]) nome = aliasesMap[nome];
    const cmd = comandosCustomizados[nome];
    if (cmd) {
      if (cmd.embed) {
        const embed = new EmbedBuilder()
          .setDescription(cmd.mensagem)
          .setColor(cmd.cor || '#0099ff');

        // Se a mensagem for uma url direta e for imagem, exibe imagem no embed
        if (cmd.mensagem?.startsWith('http') && !cmd.mensagem.includes(' ')) {
          embed.setImage(cmd.mensagem);
        }
        return message.channel.send({ embeds: [embed] });
      } else {
        return message.channel.send(cmd.mensagem);
      }
    }
  }

  // Funções utilitárias para tempo Celeste
  function parseCelesteTime(str) {
    // Aceita formatos: mm:ss.SSS, h:mm:ss.SSS, s.SSS, etc.
    const regex = /^((\d+:)?\d{1,2}:)?\d{1,2}\.\d{3}$/;
    if (!regex.test(str)) return null;
    const parts = str.split(':').reverse();
    let ms = 0;
    if (parts.length === 1) {
      ms = parseFloat(parts[0]) * 1000;
    } else if (parts.length === 2) {
      ms = (parseInt(parts[1]) * 60 + parseFloat(parts[0])) * 1000;
    } else if (parts.length === 3) {
      ms = (parseInt(parts[2]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[0])) * 1000;
    }
    return ms / 1000;
  }

  function formatCelesteTime(seconds) {
    const ms = Math.round((seconds % 1) * 1000);
    const totalSeconds = Math.floor(seconds);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    let out = '';
    if (h > 0) out += `${h}:`;
    out += `${m.toString().padStart(2, '0')}:`;
    out += `${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    return out;
  }

  function framesFromSeconds(seconds) {
    return Math.round(seconds / 0.017);
  }

  function secondsFromFrames(frames) {
    return frames * 0.017;
  }

  // Adiciona comandos !validartempo e !comparartempo
  // !validartempo <tempo>
  if (message.content.toLowerCase().startsWith('!validartempo ')) {
    const arg = message.content.slice('!validartempo '.length).trim();
    let tempo = parseCelesteTime(arg);
    if (tempo === null) {
      tempo = parseFloat(arg.replace(',', '.'));
      if (isNaN(tempo)) {
        return message.reply('❌ Tempo inválido. Use o formato mm:ss.SSS ou segundos com 3 casas decimais.');
      }
    }
    const frames = tempo / 0.017;
    const framesRounded = Math.round(frames);
    const tempoFrame = framesRounded * 0.017;
    if (Math.abs(tempo - tempoFrame) < 0.0005) {
      return message.reply(`✅ Frame válido! (${framesRounded}f)`);
    } else {
      const lowerFrame = Math.floor(frames);
      const upperFrame = Math.ceil(frames);
      const lowerTime = (lowerFrame * 0.017).toFixed(3);
      const upperTime = (upperFrame * 0.017).toFixed(3);
      return message.reply(
        `❌ Frame inválido!\nFrames mais próximos são:\n(-) ${lowerTime.padEnd(10)} (${lowerFrame}f)\n(+) ${upperTime.padEnd(10)} (${upperFrame}f)`
      );
    }
  }

  // !comparartempo <tempo1> <tempo2>
  if (message.content.toLowerCase().startsWith('!comparartempo ')) {
    const args = message.content.slice('!comparartempo '.length).trim().split(/\s+/);
    if (args.length < 2) {
      return message.reply('❌ Use: !comparartempo <tempo1> <tempo2>');
    }
    let t1 = parseCelesteTime(args[0]);
    let t2 = parseCelesteTime(args[1]);
    if (t1 === null) {
      t1 = parseFloat(args[0].replace(',', '.'));
    }
    if (t2 === null) {
      t2 = parseFloat(args[1].replace(',', '.'));
    }
    if (isNaN(t1) || isNaN(t2)) {
      return message.reply('❌ Tempos inválidos. Use o formato mm:ss.SSS ou segundos com 3 casas decimais.');
    }
    const f1 = framesFromSeconds(t1);
    const f2 = framesFromSeconds(t2);
    const diffFrames = f1 - f2;
    const diffSeconds = Math.abs(diffFrames) * 0.017;
    const sign = diffFrames >= 0 ? '' : '-';
    return message.reply(
      `➡️ ${formatCelesteTime(t1)} (${f1}f)  - ${formatCelesteTime(t2)} (${f2}f) = ${sign}${formatCelesteTime(diffSeconds)} (${Math.abs(diffFrames)}f)`
    );
  }

  // !somartempo <tempo1> <tempo2> ...
  if (message.content.toLowerCase().startsWith('!somartempo ')) {
    const args = message.content.slice('!somartempo '.length).trim().split(/\s+/);
    if (args.length < 2) {
      return message.reply('❌ Use: !somartempo <tempo1> <tempo2> ...');
    }
    let total = 0;
    let partesFormatadas = [];
    for (const arg of args) {
      let t = parseCelesteTime(arg);
      if (t === null) {
        t = parseFloat(arg.replace(',', '.'));
      }
      if (isNaN(t)) {
        return message.reply(`❌ Tempo inválido. Use o formato mm:ss.SSS ou segundos com 3 casas decimais.`);
      }
      total += t;
      partesFormatadas.push(`${formatCelesteTime(t)} (${framesFromSeconds(t)}f)`);
    }
    return message.reply(
      `+ ${partesFormatadas.join(' + ')} = ${formatCelesteTime(total)} (${framesFromSeconds(total)}f)`
    );
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const cmdName = interaction.commandName;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Apenas administradores podem usar esse comando.', ephemeral: true });
  }

  if (cmdName === 'comando') {
    const sub = interaction.options.getSubcommand();
    const nome = interaction.options.getString('nome').toLowerCase();

    // Busca o canal de log
    const logChannel = interaction.guild.channels.cache.get('1382731931883405424');

    // Função para enviar embed de log
    async function logComandoEmbed(acao) {
      if (logChannel && logChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(`Comando ${acao}`)
          .addFields(
            { name: 'Comando', value: `!${nome}` },
            { name: 'Usuário', value: `${interaction.user.tag} (<@${interaction.user.id}>)` }
          )
          .setColor(acao === 'criado' ? '#43b581' : acao === 'editado' ? '#faa61a' : '#f04747')
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    }

    if (sub === 'criar') {
      const usarEmbed = interaction.options.getBoolean('usar_embed');
      let cor = interaction.options.getString('cor');
      cor = cor?.startsWith('#') ? cor : cor ? '#' + cor : '#0099ff';

      if (comandosCustomizados[nome]) {
        return interaction.reply({ content: '❌ Comando já existe.' });
      }

      estados.criandoComando.set(userId, { nome, usarEmbed, cor });
      interaction.reply({ content: `✅ Envie agora a mensagem para o comando \`!${nome}\`. Você pode anexar uma imagem.` });

      await logComandoEmbed('criado');
      return;
    }

    if (sub === 'editar') {
      const existente = comandosCustomizados[nome];
      if (!existente) return interaction.reply({ content: '❌ Comando não existe.' });

      let novaCor = interaction.options.getString('cor');
      if (novaCor) {
        novaCor = novaCor.startsWith('#') ? novaCor : '#' + novaCor;
        comandosCustomizados[nome].cor = novaCor;
        salvarComandos();
      }

      estados.editandoComando.set(userId, { nome, etapa: 'mensagem' });
      interaction.reply({
        content: `✏️ Envie agora a nova mensagem para \`!${nome}\`. Você pode anexar uma imagem.${novaCor ? `\nCor do embed atualizada para ${novaCor}.` : ''}`
      });

      await logComandoEmbed('editado');
      return;
    }

    if (sub === 'deletar') {
      if (!comandosCustomizados[nome]) {
        return interaction.reply({ content: '❌ Comando não existe.' });
      }

      delete comandosCustomizados[nome];
      salvarComandos();
      interaction.reply({ content: `✅ Comando \`!${nome}\` deletado com sucesso.` });

      await logComandoEmbed('deletado');
      return;
    }
  }

  if (cmdName === 'help') {
    const comandos = [
      '/comando criar',
      '/comando editar',
      '/comando deletar',
      '/mensagem',
      '/editarmensagem',
      '/dm',
      '/help'
    ];
    return interaction.reply({
      content: `📋 Comandos disponíveis:\n${comandos.map(c => `• ${c}`).join('\n')}`,
      ephemeral: true
    });
  }

  if (cmdName === 'mensagem') {
    const canal = interaction.options.getChannel('canal');
    const usarEmbed = interaction.options.getBoolean('usar_embed');
    let cor = interaction.options.getString('cor');
    cor = cor?.startsWith('#') ? cor : cor ? '#' + cor : '#0099ff';
    estados.enviandoMensagem.set(userId, { canalId: canal.id, usarEmbed, cor });
    return interaction.reply({ content: `✅ Envie agora a mensagem para o canal ${canal}.`, ephemeral: true });
  }

  if (cmdName === 'editarmensagem') {
    const link = interaction.options.getString('link');
    let novaCor = interaction.options.getString('cor');
    novaCor = novaCor?.startsWith('#') ? novaCor : novaCor ? '#' + novaCor : null;

    const partes = link.split('/');
    if (partes.length < 7) return interaction.reply({ content: '❌ Link inválido.', ephemeral: true });

    const [guildIdLink, channelId, messageId] = partes.slice(5, 8);
    if (guildIdLink !== guildId) return interaction.reply({ content: '❌ Esta mensagem não pertence ao servidor.', ephemeral: true });

    estados.editandoMensagem.set(userId, { channelId, messageId, novaCor });
    return interaction.reply({ content: `✅ Envie agora o novo conteúdo para a mensagem.`, ephemeral: true });
  }

  if (cmdName === 'dm') {
    const usuarios = interaction.options.getString('usuarios');
    const mensagem = interaction.options.getString('mensagem');

    const ids = usuarios.split(/[\s,]+/);
    for (const id of ids) {
      try {
        const user = await client.users.fetch(id);
        await user.send(mensagem);
      } catch (err) {
        console.error(`Erro ao enviar DM para ${id}:`, err);
      }
    }
    return interaction.reply({ content: `✅ Mensagem enviada para ${ids.length} usuário(s).`, ephemeral: true });
  }

  // Gerenciar subcomandos de aliases
  if (cmdName === 'subcomando') {
    const sub = interaction.options.getSubcommand();
    const comando = interaction.options.getString('comando').toLowerCase();
    const alias = interaction.options.getString('alias')?.toLowerCase();

    if (sub === 'adicionar') {
      if (!comandosCustomizados[comando]) {
        return interaction.reply({ content: '❌ Comando principal não existe.', ephemeral: true });
      }

      if (!alias) {
        return interaction.reply({ content: '❌ Alias inválido.', ephemeral: true });
      }

      // Adiciona o alias ao comando principal
      if (!comandosCustomizados[comando].aliases) {
        comandosCustomizados[comando].aliases = [];
      }
      comandosCustomizados[comando].aliases.push(alias);
      salvarComandos();

      // Atualiza o aliasesMap
      aliasesMap[alias] = comando;

      return interaction.reply({ content: `✅ Alias \`${alias}\` adicionado ao comando \`!${comando}\`.`, ephemeral: true });
    }

    if (sub === 'remover') {
      if (!comandosCustomizados[comando]) {
        return interaction.reply({ content: '❌ Comando principal não existe.', ephemeral: true });
      }

      if (!alias || !comandosCustomizados[comando].aliases?.includes(alias)) {
        return interaction.reply({ content: '❌ Alias não encontrado.', ephemeral: true });
      }

      // Remove o alias do comando principal
      comandosCustomizados[comando].aliases = comandosCustomizados[comando].aliases.filter(a => a !== alias);
      salvarComandos();

      // Atualiza o aliasesMap
      delete aliasesMap[alias];

      return interaction.reply({ content: `✅ Alias \`${alias}\` removido do comando \`!${comando}\`.`, ephemeral: true });
    }
  }
});

const cargoKickId = '1401330736442638497'; // ID do cargo proibido
const logChannelId = '1382731931883405424'; // ID do canal de log



async function kickarMembro(membro, motivo) {
  try {
    await membro.kick(motivo);

    const logChannel = membro.guild.channels.cache.get(logChannelId);

    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🚫 Membro kickado por cargo proibido')
        .setColor('#f04747')
        .addFields(
          { name: 'Usuário', value: `${membro.user.tag} (<@${membro.user.id}>)` },
          { name: 'ID', value: membro.user.id, inline: true },
          { name: 'Entrou no servidor', value: `<t:${Math.floor(membro.joinedTimestamp / 1000)}:F>`, inline: true },
          { name: 'Motivo', value: motivo }
        )

        .setThumbnail(membro.user.displayAvatarURL())
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }

  } catch (err) {
    console.error(`Erro ao kickar ${membro.user.tag}:`, err);
  }

}



// Caso 1: membro entra já com o cargo proibido

client.on('guildMemberAdd', async (member) => {
  if (member.roles.cache.has(cargoKickId)) {
    await kickarMembro(member, 'Entrou com cargo proibido');
  }
});



// Caso 2: membro recebe o cargo proibido depois de entrar

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Loga no console quando um membro recebe qualquer cargo novo
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));

  if (addedRoles.size > 0) {
    addedRoles.forEach(role => {
      console.log(`Membro ${newMember.user.tag} (${newMember.user.id}) recebeu o cargo: ${role.name} (${role.id})`);
    });

  }



  const tinhaAntes = oldRoles.has(cargoKickId);
  const temAgora = newRoles.has(cargoKickId);



  if (!tinhaAntes && temAgora) {
    await kickarMembro(newMember, 'Recebeu cargo proibido');
  }

});

client.login(token);