// Funções utilitárias para tempo do jogo Celeste

/**
 * Converte uma string de tempo (ex: "1:23.456") para segundos.
 * @param {string} str A string de tempo.
 * @returns {number|null} O tempo total em segundos, ou null se for inválido.
 */
function parseCelesteTime(str) {
    if (typeof str !== 'string') return null;
    
    const a = str.replace(',', '.');
    if (!/^[0-9.:]+$/.test(a)) return null;
    
    const parts = a.split(':');
    let totalSeconds = 0;

    try {
        if (parts.length === 1) {
            totalSeconds = parseFloat(parts[0]);
        } else if (parts.length === 2) {
            totalSeconds = (parseInt(parts[0], 10) * 60) + parseFloat(parts[1]);
        } else if (parts.length === 3) {
            totalSeconds = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseFloat(parts[2]);
        } else {
            return null;
        }
        return isNaN(totalSeconds) ? null : totalSeconds;
    } catch {
        return null;
    }
}

/**
 * Formata segundos para o formato de tempo do Celeste (ex: "01:23.456").
 * @param {number} seconds O total de segundos.
 * @returns {string} O tempo formatado.
 */
function formatCelesteTime(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return "00:00.000";

    const ms = Math.round((seconds % 1) * 1000);
    const totalSecondsInt = Math.floor(seconds);
    const s = totalSecondsInt % 60;
    const m = Math.floor(totalSecondsInt / 60) % 60;
    const h = Math.floor(totalSecondsInt / 3600);
    
    let out = '';
    if (h > 0) out += `${h}:`;
    if (h > 0) out += `${m.toString().padStart(2, '0')}:`;
    else out += `${m}:`;
    
    out += `${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    return out;
}

/**
 * Converte segundos para o número equivalente de frames no jogo.
 * @param {number} seconds O total de segundos.
 * @returns {number} O número de frames.
 */
function framesFromSeconds(seconds) {
    return Math.round(seconds / 0.017);
}

module.exports = {
    parseCelesteTime,
    formatCelesteTime,
    framesFromSeconds,
};
