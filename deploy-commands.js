const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits} = require('discord.js');
const { token } = require('./src/config.json');

const clientId = '1381715684752363560';
const guildId = '1016303042309668894';

const commands = [
  new SlashCommandBuilder()
    .setName('mensagem')
    .setDescription('Enviar mensagem pelo bot em um canal específico (somente moderadores)')
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal para enviar a mensagem')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('embed')
        .setDescription('Enviar como embed?')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('editarmensagem')
    .setDescription('Editar mensagem enviada pelo bot pelo link')
    .addStringOption(option =>
      option
        .setName('link')
        .setDescription('Link da mensagem a ser editada')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('criarcomando')
    .setDescription('Abre um formulário para criar um comando personalizado')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registrando comandos slash...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Comandos registrados com sucesso!');
  } catch (error) {
    console.error(error);
  }
})();
