const {
  Client, GatewayIntentBits, EmbedBuilder, Events, PermissionFlagsBits,
  SlashCommandBuilder, REST, Routes, ChannelType
} = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
const fs = require('fs');
const path = require('path');

const comandosPath = path.join(__dirname, 'comandos.json');
let comandosCustomizados = {};
if (fs.existsSync(comandosPath)) {
  comandosCustomizados = JSON.parse(fs.readFileSync(comandosPath, 'utf8'));
}
function salvarComandos() {
  fs.writeFileSync(comandosPath, JSON.stringify(comandosCustomizados, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const estados = {
  criandoComando: new Map(),
  editandoComando: new Map(),
  enviandoMensagem: new Map(),
  editandoMensagem: new Map(),
};

async function registrarComandos() {
  const comandos = [
    new SlashCommandBuilder()
      .setName('criarcomando')
      .setDescription('Cria um comando personalizado')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true))
      .addBooleanOption(opt => opt.setName('usar_embed').setDescription('Usar embed?').setRequired(true))
      .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed (hex)').setRequired(false)),

    new SlashCommandBuilder()
      .setName('editarcomando')
      .setDescription('Editar comando')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true)),

    new SlashCommandBuilder()
      .setName('deletarcomando')
      .setDescription('Deleta comando')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do comando').setRequired(true)),

    new SlashCommandBuilder()
      .setName('mensagem')
      .setDescription('Envia mensagem do bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText)),

    new SlashCommandBuilder()
      .setName('editarmensagem')
      .setDescription('Edita mensagem enviada pelo bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt => opt.setName('link').setDescription('Link da mensagem').setRequired(true)),

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
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: comandos.map(c => c.toJSON())
  });
}

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  registrarComandos();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const cmdName = interaction.commandName;

  // Comando /help só para admins
  if (cmdName === 'help') {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Apenas administradores.', ephemeral: true });
    }
    // Listar comandos slash
    const comandosSlash = [
      '/criarcomando (Cria um comando personalizado)',
      '/editarcomando (Edita um comando existente)',
      '/deletarcomando (Deleta um comando)',
      '/mensagem (Envia mensagem do bot para um canal)',
      '/editarmensagem (Edita mensagem enviada pelo bot)',
      '/dm (Envia uma DM para um usuário)',
      '/help (Lista comandos de barra disponíveis)'
    ];
    return interaction.reply({
      content: `### Comandos de barra disponíveis:\n${comandosSlash.join('\n')}`,
      ephemeral: true
    });
  }

  // Para os outros comandos, verificar permissão admin (exceto !ajuda que é por mensagem)
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'Apenas administradores.', ephemeral: true });
  }

  if (cmdName === 'criarcomando') {
    const nome = interaction.options.getString('nome').toLowerCase();
    const usarEmbed = interaction.options.getBoolean('usar_embed');
    let cor = interaction.options.getString('cor');
    cor = cor?.startsWith('#') ? cor : cor ? '#' + cor : '#0099ff';

    if (comandosCustomizados[nome]) {
      return interaction.reply({ content: 'Comando já existe.', ephemeral: true });
    }

    estados.criandoComando.set(userId, { nome, usarEmbed, cor, channelId: interaction.channelId });
    return interaction.reply({ content: `Envie a mensagem para !${nome}. Você pode anexar uma imagem.`, ephemeral: true });
  }

  if (cmdName === 'editarcomando') {
    const nome = interaction.options.getString('nome').toLowerCase();
    const existente = comandosCustomizados[nome];
    if (!existente) return interaction.reply({ content: 'Comando não existe.', ephemeral: true });

    estados.editandoComando.set(userId, { nome, etapa: 'mensagem' });
    return interaction.reply({ content: `Envie a nova mensagem para !${nome}. Você pode anexar uma imagem.`, ephemeral: true });
  }

  if (cmdName === 'deletarcomando') {
    const nome = interaction.options.getString('nome').toLowerCase();
    if (!comandosCustomizados[nome]) {
      return interaction.reply({ content: 'Comando não existe.', ephemeral: true });
    }
    // Deleta do JSON
    delete comandosCustomizados[nome];
    salvarComandos();

    // Opcional: Para garantir que o comando não fique registrado em cache ou algo, 
    // podemos apenas responder, pois esses comandos são custom e chamados via !nome,
    // e não slash commands.
    return interaction.reply({ content: `Comando !${nome} deletado com sucesso.`, ephemeral: true });
  }

  if (cmdName === 'mensagem') {
    const canal = interaction.options.getChannel('canal');
    estados.enviandoMensagem.set(userId, { canalId: canal.id });
    return interaction.reply({ content: `Envie a mensagem para ${canal}. Você pode anexar uma imagem.`, ephemeral: true });
  }

  if (cmdName === 'editarmensagem') {
    const link = interaction.options.getString('link');
    const partes = link.split('/');
    if (partes.length < 7) return interaction.reply({ content: 'Link inválido.', ephemeral: true });
    const [guildIdLink, channelIdLink, messageIdLink] = partes.slice(4);
    estados.editandoMensagem.set(userId, { channelId: channelIdLink, messageId: messageIdLink });
    return interaction.reply({ content: 'Envie a nova mensagem. Você pode anexar uma imagem.', ephemeral: true });
  } 
  
  if (cmdName === 'dm') {
    const usuariosRaw = interaction.options.getString('usuarios');
    const mensagem = interaction.options.getString('mensagem');
    // Extrai IDs de menções ou IDs puros
    const ids = usuariosRaw.match(/\d{17,}/g);
    if (!ids || ids.length === 0) {
      return interaction.reply({ content: 'Nenhum usuário válido informado.', ephemeral: true });
    }
    let enviados = 0, falhas = 0;
    for (const id of ids) {
      try {
        const user = await client.users.fetch(id);
        await user.send(mensagem);
        enviados++;
      } catch {
        falhas++;
      }
    }
    return interaction.reply({
      content: `DM enviada para ${enviados} usuário(s).${falhas ? ` Falha em ${falhas}.` : ''}`,
      ephemeral: true
    });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const userId = message.author.id;

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
    const { nome, etapa } = estados.editandoComando.get(userId);
    if (etapa === 'mensagem') {
      const image = getImageURL();
      const conteudo = message.content.trim();

      if (!conteudo && !image) {
        return message.reply('Envie uma mensagem ou anexe uma imagem para o comando.');
      }

      comandosCustomizados[nome].mensagem = conteudo || image;
      if (comandosCustomizados[nome].embed) {
        estados.editandoComando.set(userId, { nome, etapa: 'cor' });
        return message.reply('Deseja mudar a cor? Envie o novo valor (ex: #ff0000) ou "pular".');
      } else {
        salvarComandos();
        estados.editandoComando.delete(userId);
        return message.reply('Comando editado.');
      }
    } else if (etapa === 'cor') {
      const cor = message.content.trim();
      if (cor.toLowerCase() !== 'pular') {
        if (!/^#?[0-9A-F]{6}$/i.test(cor)) return message.reply('Cor inválida. Use hexadecimal, ex: #00ff00');
        comandosCustomizados[nome].cor = cor.startsWith('#') ? cor : '#' + cor;
      }
      salvarComandos();
      estados.editandoComando.delete(userId);
      return message.reply('Comando editado.');
    }
  }

  // Estado enviando mensagem via /mensagem
  if (estados.enviandoMensagem.has(userId)) {
    const { canalId } = estados.enviandoMensagem.get(userId);
    const canal = message.guild.channels.cache.get(canalId);
    if (!canal) return message.reply('Canal inválido.');

    const image = getImageURL();
    const embed = new EmbedBuilder().setDescription(message.content);
    if (image) embed.setImage(image);

    await canal.send({ embeds: [embed] });
    estados.enviandoMensagem.delete(userId);
    return message.reply('Mensagem enviada.');
  }

  // Estado editando mensagem via /editarmensagem
  if (estados.editandoMensagem.has(userId)) {
    const { channelId, messageId } = estados.editandoMensagem.get(userId);
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
    const embed = new EmbedBuilder().setDescription(message.content);
    if (image) embed.setImage(image);

    await targetMsg.edit({ embeds: [embed] });
    estados.editandoMensagem.delete(userId);
    return message.reply('Mensagem editada.');
  }

  // Comando !ajuda para qualquer membro listar comandos customizados
  if (message.content.trim().toLowerCase() === '!ajuda') {
    const nomes = Object.keys(comandosCustomizados);
    if (nomes.length === 0) {
      return message.reply('Não há comandos cadastrados.');
    }
    // Filtra comandos que começam com "regra"
    const comandosRegra = nomes.filter(n => n.startsWith('regra'));
    const outrosComandos = nomes.filter(n => !n.startsWith('regra'));
    let lista = '';
    if (comandosRegra.length > 0) {
      lista += '!regra X';
      if (outrosComandos.length > 0) lista += ' // ';
    }
    lista += outrosComandos.map(n => `!${n}`).join(' // ');
    return message.reply(`**Comandos disponíveis:**\n${lista}`);
  }

  // Executar comandos customizados (!nome)
  if (message.content.startsWith('!')) {
    const nome = message.content.slice(1).toLowerCase();
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
});

client.login(token);