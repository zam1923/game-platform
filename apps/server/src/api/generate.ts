import type { FastifyInstance } from 'fastify';
import type { RoomManager } from '../room-manager.js';
import type { Server as SocketServer } from 'socket.io';
import type { GameProvider } from '../room-manager.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveGameHtmlToDb } from '../db.js';

interface GenerateBody {
  roomCode: string;
  apiKey: string;
  description: string;
  playerName?: string;
  provider: GameProvider;
  mode?: 'solo' | 'free' | 'challenge';
  gameType?: 'solo' | 'multi';
}

// ゲーム生成用プロンプト（サーバーサイドで品質管理）
function buildGamePrompt(description: string, gameType: 'solo' | 'multi'): string {
  if (gameType === 'solo') {
    // ─── 一人用スタンドアロンゲーム ───────────────────────────────────────
    return `以下の条件でブラウザゲームを作ってください。

【ゲーム内容】
${description}

【ゲームの形式】
これは1人でプレイする完全スタンドアロンゲームです。
- platform.js は不要です（<script src="/platform.js"> は含めないでください）
- キーボード・マウス・タップ操作に対応した1人用ゲームにしてください
- スコア表示・クリア条件・ゲームオーバーなど、1人用として完結した設計にしてください
- 複数プレイヤーへの言及は一切不要です

【技術仕様（必ず守ること）】
- 自己完結したHTMLファイル1つで書く（外部ライブラリ不可。CSSはstyleタグに記述）
- JavaScriptはscriptタグにインラインで記述
- モバイル対応のレスポンシブデザインにすること
- CSSアニメーション、グラデーション、カラフルなデザインにすること

HTMLのコードブロック（\`\`\`html....\`\`\`）で出力してください。`;
  }

  // ─── マルチプレイヤーゲーム ─────────────────────────────────────────────
  const modeNote = `【絶対条件】このゲームは必ずマルチプレイヤーゲームにしてください。
- 1人で完結するゲームは絶対禁止です
- platform.players の全員が同時にプレイできるゲームにしてください
- 対戦形式（誰かが勝つ）または協力形式（全員で目標達成）のどちらかにしてください
- 1人が操作して他が見るだけ、という受動的な体験は避けてください`;

  return `以下の条件でブラウザゲームを作ってください。

【ゲーム内容】
${description}

【ゲームの形式】
${modeNote}

【技術仕様（必ず守ること）】
- 自己完結したHTMLファイル1つで書く（外部ライブラリ不可。CSSはstyleタグに記述）
- <head>内に <script src="/platform.js"></script> を必ず含める
- ゲームロジックはホスト（platform.isHostがtrue）が担当する
  - platform.onAction((action, playerId) => { ... }) でアクションを受け取る
  - 状態を更新したら platform.broadcast(newState) で全員に送信する
  - platform.broadcastEvent({ type: '...', data: ... }) で演出を全員に送れる
- 全員が platform.onState(state => { ... }) でUIを更新する
- アクション送信: platform.dispatch({ type: '...', ...data })
- プレイヤー情報: platform.me.name, platform.me.id, platform.players
- 初期化後に実行: platform.onReady(() => { ... })

【利用可能なAPI一覧】
platform.isHost         — ホストかどうか
platform.me             — { id, name } 自分の情報
platform.players        — 全プレイヤーの配列
platform.onReady(fn)    — 初期化完了後に実行
platform.onState(fn)    — 状態更新コールバック
platform.dispatch(obj)  — アクション送信（全員）
platform.onAction(fn)   — アクション受信（ホスト専用）
platform.broadcast(obj) — 状態を全員に送信（ホスト専用）
platform.onEvent(fn)    — イベント受信コールバック
platform.broadcastEvent(obj) — 全員にイベント送信（ホスト専用）
platform.onPlayerJoin(fn)   — プレイヤー参加時
platform.onPlayerLeave(fn)  — プレイヤー退出時

【ビジュアル要件】
- CSSアニメーション、グラデーション、カラフルなデザインにすること
- 絵文字やSVGを活用してビジュアルを豊かにすること
- モバイル対応のレスポンシブデザインにすること

HTMLのコードブロック（\`\`\`html....\`\`\`）で出力してください。`;
}

// レスポンスからHTMLを抽出
function extractHtml(text: string): string | null {
  // ```html...``` ブロックから抽出
  const match = text.match(/```html\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  // フォールバック: <!DOCTYPE または <html で始まる場合
  const trimmed = text.trim();
  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
    return trimmed;
  }
  return null;
}

export function registerGenerateRoute(
  app: FastifyInstance,
  rooms: RoomManager,
  io: SocketServer,
): void {
  app.post<{ Body: GenerateBody }>('/api/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['roomCode', 'apiKey', 'description', 'provider'],
        properties: {
          roomCode:    { type: 'string' },
          apiKey:      { type: 'string' },
          description: { type: 'string', maxLength: 500 },
          playerName:  { type: 'string', maxLength: 50 },
          provider:    { type: 'string', enum: ['claude', 'openai', 'gemini'] },
          mode:        { type: 'string', enum: ['solo', 'free', 'challenge'] },
          gameType:    { type: 'string', enum: ['solo', 'multi'] },
        },
      },
    },
  }, async (request, reply) => {
    const { roomCode, apiKey, description, playerName = 'AI', provider } = request.body;

    // ルーム認証
    const room = rooms.getRoomByApiKey(apiKey);
    if (!room) {
      return reply.status(401).send({ ok: false, error: 'APIキーが無効です' });
    }
    if (room.code !== roomCode.toUpperCase()) {
      return reply.status(400).send({ ok: false, error: 'ルームコードが一致しません' });
    }

    // プロバイダごとのAPIキー確認
    const providerKeyMap: Record<string, string | undefined> = {
      claude: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GOOGLE_AI_API_KEY,
    };

    if (!providerKeyMap[provider]) {
      const providerNames: Record<string, string> = { claude: 'Claude', openai: 'GPT-4o', gemini: 'Gemini' };
      return reply.status(503).send({
        ok: false,
        error: `${providerNames[provider] ?? provider}のAPIキーがサーバーに設定されていません`,
      });
    }

    // 全員に生成開始通知
    io.to(room.code).emit('game:generating', { playerName, description, provider });

    // ルームの gameType を使う（リクエストの gameType より信頼できる）
    const effectiveGameType = room.gameType ?? 'multi';
    const prompt = buildGamePrompt(description, effectiveGameType);
    let responseText: string;

    try {
      if (provider === 'claude') {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        });
        const firstContent = message.content[0];
        responseText = firstContent.type === 'text' ? firstContent.text : '';

      } else if (provider === 'openai') {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = response.choices[0]?.message?.content ?? '';

      } else { // gemini
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      }
    } catch (err) {
      const error = err as Error;
      io.to(room.code).emit('game:generateFailed', { playerName, error: error.message });
      return reply.status(500).send({ ok: false, error: 'AI生成に失敗しました: ' + error.message });
    }

    // HTMLを抽出
    const html = extractHtml(responseText);
    if (!html) {
      io.to(room.code).emit('game:generateFailed', { playerName, error: 'HTMLの抽出に失敗しました' });
      return reply.status(500).send({ ok: false, error: 'HTMLの抽出に失敗しました' });
    }

    // デプロイ
    const gameName = description.slice(0, 50) || '生成されたゲーム';
    const game = rooms.deployGame(room, {
      name: gameName,
      html,
      deployedBy: playerName,
      provider,
    });

    // ゲームHTMLをDBに保存
    await saveGameHtmlToDb(game.id, room.code, html);

    // 全員にデプロイ通知
    io.to(room.code).emit('game:deployed', {
      id: game.id,
      name: game.name,
      deployedBy: game.deployedBy,
      provider: game.provider,
    });

    return reply.send({ ok: true, gameId: game.id, name: game.name, provider });
  });
}
