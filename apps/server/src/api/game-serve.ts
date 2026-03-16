import type { FastifyInstance } from 'fastify';
import type { RoomManager } from '../room-manager.js';
import { getGameHtmlFromDb } from '../db.js';

/**
 * GET /game/:roomCode/:gameId
 * iframeのsrcとして読み込まれるゲームHTML。
 * platform.jsと同じオリジンから配信されるので、<script src="/platform.js">が動く。
 */
export function registerGameServeRoute(
  app: FastifyInstance,
  rooms: RoomManager,
): void {
  app.get<{
    Params: { roomCode: string; gameId: string };
  }>('/game/:roomCode/:gameId', async (request, reply) => {
    const { roomCode, gameId } = request.params;

    // メモリ上のゲームを探す
    const room = rooms.getRoom(roomCode);
    const game = room ? rooms.getGame(room, gameId) : null;

    // メモリになければDBから取得（サーバー再起動後の復元）
    let html: string;
    if (game) {
      html = game.html;
    } else {
      const dbHtml = await getGameHtmlFromDb(gameId);
      if (!dbHtml) {
        return reply.status(404).send('Game not found');
      }
      html = dbHtml;
    }

    // すでにplatform.jsが含まれていない場合は注入
    if (!html.includes('platform.js')) {
      html = html.replace(
        /<head([^>]*)>/i,
        '<head$1>\n  <script src="/platform.js"></script>',
      );
      // headタグがない場合はhtmlタグの直後に挿入
      if (!html.includes('/platform.js')) {
        html = `<script src="/platform.js"></script>\n${html}`;
      }
    }

    reply.header('Content-Type', 'text/html; charset=utf-8');
    // XSS対策: allow-same-origin は付けない（プラットフォームのDOMにアクセスさせない）
    // これはiframe側のコンテンツなので、sandbox属性はGame.tsxのiframeに指定
    return reply.send(html);
  });
}
