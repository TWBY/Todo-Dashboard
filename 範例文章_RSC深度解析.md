# 從零開始理解 React Server Components：為什麼我們需要它？

## 餐廳點餐的啟示

想像你走進一家餐廳。傳統的做法是：服務生把整本厚重的食材目錄搬到你桌上，裡面有生雞肉、生魚片、各種香料的詳細介紹，然後你得自己在桌上烹飪。這聽起來很荒謬，對吧？但這正是傳統 Client-side React 應用在做的事情——把所有原始資料和處理邏輯都丟給瀏覽器。

而 React Server Components (RSC) 的出現，就像餐廳終於想通了：為什麼不在廚房把菜做好，只把煮好的餐點端給客人？客人只需要享用，不需要知道食材從哪裡來、怎麼烹調。

這個看似簡單的轉變，背後卻是 React 團隊對 Web 開發範式的深刻反思。今天，我們要深入探討這個改變遊戲規則的技術創新。

## 傳統 React 的困境：我們是怎麼走到今天的？

### Client-side Rendering 的美好與代價

2013 年 React 誕生時，它的核心賣點是「把 UI 當作狀態的函數」。這個概念優雅而強大：

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  if (!user) return <div>載入中...</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}
```

這段程式碼簡單直觀，但隱藏著三個致命問題：

**問題一：白屏等待**。使用者首次載入頁面時，看到的是空白畫面或 Loading spinner，直到 JavaScript 下載完成、執行、發送 API 請求、拿到資料、渲染元件。這個過程可能長達數秒，在慢速網路環境下更是災難。

**問題二：Bundle 膨脹**。為了在客戶端處理資料，你需要打包所有相關的函式庫。想用 `date-fns` 格式化日期？130KB。想用 `lodash` 處理陣列？70KB。這些重量級工具都得塞進瀏覽器。

**問題三：SEO 困境**。搜尋引擎爬蟲看到的 HTML 只有一個空殼：`<div id="root"></div>`。雖然 Google 聲稱可以執行 JavaScript，但實際效果不穩定，而且其他搜尋引擎未必跟進。

### Server-side Rendering 的妥協之道

於是我們有了 SSR（Server-side Rendering）。Next.js、Nuxt.js 等框架讓伺服器先執行 React，生成完整的 HTML，再送到瀏覽器：

```typescript
// Next.js Pages Router 的 SSR
export async function getServerSideProps({ params }) {
  const user = await fetch(`https://api.example.com/users/${params.userId}`)
    .then(res => res.json());

  return {
    props: { user }
  };
}

export default function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}
```

使用者瞬間看到完整內容，搜尋引擎也能抓到有意義的 HTML。問題解決了嗎？

**並沒有。**

SSR 的本質是「渲染兩次」：伺服器渲染一次產生 HTML，瀏覽器載入 JavaScript 後再渲染一次來「接管」DOM（這個過程叫 Hydration）。你仍然需要把整個元件的 JavaScript 程式碼送到瀏覽器，Bundle 大小沒有減少。

更糟的是，Hydration 本身就是效能瓶頸。瀏覽器必須：

1. 下載並解析 JavaScript Bundle
2. 重新執行元件邏輯
3. 對比虛擬 DOM 與真實 DOM
4. 綁定事件監聽器

在這個過程中，頁面看起來已經可以互動，但實際上「點不動」——這就是常見的 TTI (Time to Interactive) 延遲問題。

### 混合渲染的複雜性

為了優化，開發者開始混用 SSR、SSG (Static Site Generation)、ISR (Incremental Static Regeneration)：

```typescript
// 這個頁面用 SSG 預先生成
export async function getStaticProps() {
  const posts = await fetchPosts();
  return { props: { posts }, revalidate: 60 };
}

// 這個頁面用 SSR 即時渲染
export async function getServerSideProps() {
  const user = await getCurrentUser();
  return { props: { user } };
}

// 這個元件在客戶端抓資料
function Comments() {
  const { data } = useSWR('/api/comments', fetcher);
  return <CommentList comments={data} />;
}
```

每種方法都有適用場景，但選擇哪種方法需要深厚的經驗。更麻煩的是，這些決策都是「頁面級別」的——整個頁面只能選一種策略，無法針對頁面內的不同區塊分別優化。

## React Server Components 的革命性突破

### 設計哲學：Zero Bundle Size Components

2020 年，React 團隊提出一個大膽的想法：**如果某個元件完全不需要客戶端邏輯，為什麼要把它的程式碼送到瀏覽器？**

這就是 React Server Components 的核心理念。它不是改進 SSR，而是重新定義「元件」的邊界。

在 RSC 架構下，元件分為三種：

**1. Server Components（預設）**：完全在伺服器執行，程式碼不會進入 Bundle。

```typescript
// app/UserProfile.tsx (Server Component)
import { db } from '@/lib/database';
import { formatDate } from 'date-fns'; // 這個套件不會進入 Bundle！

export default async function UserProfile({ userId }: { userId: string }) {
  // 直接存取資料庫，不需要 API Route
  const user = await db.user.findUnique({ where: { id: userId } });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>加入於 {formatDate(user.createdAt, 'yyyy/MM/dd')}</p>
      <p>{user.bio}</p>
    </div>
  );
}
```

這段程式碼的「魔法」在於：

- `db` 和 `formatDate` 只在伺服器執行，瀏覽器永遠看不到它們的程式碼
- 使用者下載的 Bundle 裡沒有資料庫查詢邏輯，也沒有 `date-fns` 函式庫
- 伺服器直接把渲染好的 JSX 結構傳給瀏覽器

**2. Client Components**：需要互動性或瀏覽器 API 的元件。

```typescript
// app/LikeButton.tsx (Client Component)
'use client';

import { useState } from 'react';

export default function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false);

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? '已按讚' : '按讚'}
    </button>
  );
}
```

注意頂部的 `'use client'` 指令——這是告訴 React：「這個元件需要在瀏覽器執行」。

**3. Shared Components**：兩邊都能用的純展示元件（無狀態、無副作用）。

```typescript
// components/Badge.tsx (Shared Component)
export default function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
```

### RSC Payload：快遞包裹的比喻

當你請求一個使用 RSC 的頁面時，伺服器不是直接回傳 HTML，而是回傳一種特殊格式的「描述」，稱為 RSC Payload。

想像你在網路上訂購一組家具。傳統的 SSR 就像賣家把組裝好的家具寄給你（HTML），但你仍然要自己拆解、檢查每個零件（Hydration）。

而 RSC 的做法是：賣家寄給你一個「組裝指南」（RSC Payload），裡面標註了：

- 哪些部分已經在工廠做好了（Server Components 的渲染結果）
- 哪些部分需要你自己組裝（Client Components 的程式碼位置）
- 如何把這些部分拼起來（元件樹結構）

實際的 RSC Payload 長這樣（簡化版）：

```
M1:{"id":"./app/UserProfile.tsx","chunks":[],"name":""}
S2:"react.suspense"
J0:["$","div",null,{"children":[
  ["$","h1",null,{"children":"張三"}],
  ["$","p",null,{"children":"加入於 2024/01/15"}],
  ["$","@1",null,{"postId":"123"}]
]}]
M1:{"id":"./app/LikeButton.tsx","chunks":["client1.js"],"name":"default"}
```

這段「密語」告訴 React：

- `J0` 開頭的是 JSON 格式的元件樹
- `@1` 表示「這裡要插入一個 Client Component，程式碼在 `client1.js` 裡」
- 文字內容（「張三」、「加入於 2024/01/15」）直接嵌入，不需要執行任何 JavaScript 就能顯示

瀏覽器收到這個 Payload 後：

1. 立刻渲染 Server Components 的部分（無需等待 JavaScript）
2. 非同步載入 `client1.js`（只包含 LikeButton，非常小）
3. Hydrate LikeButton，綁定事件監聽器

整個過程比傳統 SSR 快很多，因為大部分內容不需要 Hydration。

### 與 SSR 的本質差異

很多人誤以為 RSC 只是「更好的 SSR」，但它們根本不是同一個層次的概念：

| 特性 | 傳統 SSR | React Server Components |
|------|---------|------------------------|
| 渲染位置 | 伺服器生成初始 HTML | 伺服器串流式生成元件樹 |
| Hydration | 整個頁面都需要 | 只有 Client Components 需要 |
| Bundle 大小 | 包含所有元件程式碼 | 只包含 Client Components |
| 資料抓取 | 頁面級別（getServerSideProps） | 元件級別（async component） |
| 程式碼分割 | 手動設定 dynamic import | 自動分割 Server/Client |

更重要的是，RSC 允許「元件級別」的優化決策：

```typescript
// app/Dashboard.tsx (Server Component)
import ClientChart from './ClientChart'; // Client Component
import ServerStats from './ServerStats'; // Server Component

export default async function Dashboard() {
  const stats = await fetchStats(); // 在伺服器執行

  return (
    <div>
      <ServerStats data={stats} /> {/* 不進 Bundle */}
      <ClientChart data={stats} /> {/* 進 Bundle，可互動 */}
    </div>
  );
}
```

你可以在同一個頁面裡混用 Server 和 Client Components，各取所需。

## 實戰案例：RSC 如何改變開發方式

### 案例一：資料抓取的典範轉移

**傳統方法（Next.js Pages Router）：**

```typescript
// pages/posts/[id].tsx
export async function getServerSideProps({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`)
    .then(res => res.json());

  const author = await fetch(`https://api.example.com/users/${post.authorId}`)
    .then(res => res.json());

  const comments = await fetch(`https://api.example.com/comments?postId=${params.id}`)
    .then(res => res.json());

  return {
    props: { post, author, comments }
  };
}

export default function PostPage({ post, author, comments }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <AuthorCard author={author} />
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <CommentList comments={comments} />
    </article>
  );
}
```

這個方法的問題：

1. **序列式抓取**：必須等 `post` 回來才能知道 `authorId`，然後才能抓 `author`
2. **過度抓取**：即使使用者不滾動到留言區，`comments` 也會被抓取
3. **Props drilling**：`author` 和 `comments` 必須透過 props 傳遞，即使中間層元件不使用

**RSC 方法（Next.js App Router）：**

```typescript
// app/posts/[id]/page.tsx (Server Component)
export default async function PostPage({ params }: { params: { id: string } }) {
  // 並行抓取 post 和 comments（不用等 post 回來）
  const postPromise = fetch(`https://api.example.com/posts/${params.id}`).then(res => res.json());
  const commentsPromise = fetch(`https://api.example.com/comments?postId=${params.id}`).then(res => res.json());

  const post = await postPromise;

  return (
    <article>
      <h1>{post.title}</h1>
      <Suspense fallback={<AuthorSkeleton />}>
        <AuthorCard authorId={post.authorId} /> {/* 這裡會自己抓資料 */}
      </Suspense>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentList commentsPromise={commentsPromise} />
      </Suspense>
    </article>
  );
}

// components/AuthorCard.tsx (Server Component)
async function AuthorCard({ authorId }: { authorId: string }) {
  const author = await fetch(`https://api.example.com/users/${authorId}`)
    .then(res => res.json());

  return (
    <div className="author-card">
      <img src={author.avatar} alt={author.name} />
      <p>{author.name}</p>
    </div>
  );
}

// components/CommentList.tsx (Server Component)
async function CommentList({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = await commentsPromise; // 使用外層已經開始的請求

  return (
    <ul>
      {comments.map(comment => (
        <li key={comment.id}>{comment.text}</li>
      ))}
    </ul>
  );
}
```

這個方法的優勢：

1. **並行抓取**：`post` 和 `comments` 同時發送請求
2. **串流渲染**：`AuthorCard` 可以比 `CommentList` 更早顯示
3. **按需載入**：可以輕鬆改成「滾動到留言區才載入」
4. **無 Props drilling**：每個元件自己抓需要的資料

### 案例二：檔案系統操作

傳統 React 無法直接讀取檔案系統，必須建立 API Route：

```typescript
// pages/api/blog/[slug].ts (API Route)
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { slug } = req.query;
  const filePath = path.join(process.cwd(), 'content', `${slug}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');
  res.json({ content });
}

// pages/blog/[slug].tsx (Client Component)
export default function BlogPost({ slug }) {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then(res => res.json())
      .then(data => setContent(data.content));
  }, [slug]);

  return <div>{content}</div>;
}
```

使用 RSC，直接在元件裡讀取檔案：

```typescript
// app/blog/[slug]/page.tsx (Server Component)
import fs from 'fs/promises';
import path from 'path';
import { remark } from 'remark';
import html from 'remark-html';

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const filePath = path.join(process.cwd(), 'content', `${params.slug}.md`);
  const markdown = await fs.readFile(filePath, 'utf-8');

  const processedContent = await remark()
    .use(html)
    .process(markdown);

  const contentHtml = processedContent.toString();

  return (
    <article>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </article>
  );
}
```

沒有 API Route，沒有客戶端請求，沒有 Loading 狀態。程式碼更簡潔，效能更好。

### 案例三：敏感資訊保護

這是 RSC 最實用的優勢之一。想像你需要呼叫第三方 API，但 API Key 不能暴露給瀏覽器：

**傳統方法：**

```typescript
// .env.local
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx

// pages/api/payment.ts (必須建立 API Route)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req, res) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: req.body.amount,
    currency: 'usd',
  });

  res.json({ clientSecret: paymentIntent.client_secret });
}

// components/CheckoutForm.tsx (Client Component)
'use client';

export default function CheckoutForm() {
  const handleSubmit = async () => {
    const response = await fetch('/api/payment', {
      method: 'POST',
      body: JSON.stringify({ amount: 1000 }),
    });

    const { clientSecret } = await response.json();
    // 使用 clientSecret 完成付款...
  };

  return <button onClick={handleSubmit}>付款</button>;
}
```

**RSC 方法：**

```typescript
// app/checkout/page.tsx (Server Component)
import Stripe from 'stripe';
import CheckoutForm from './CheckoutForm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // 這裡的 Key 不會進 Bundle！

export default async function CheckoutPage() {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'usd',
  });

  return <CheckoutForm clientSecret={paymentIntent.client_secret} />;
}

// app/checkout/CheckoutForm.tsx (Client Component)
'use client';

export default function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  const handleSubmit = async () => {
    // 直接使用 prop 傳進來的 clientSecret
    // 完成付款...
  };

  return <button onClick={handleSubmit}>付款</button>;
}
```

注意：`STRIPE_SECRET_KEY` 只在 Server Component 裡使用，永遠不會被打包進 JavaScript Bundle。即使使用者打開 DevTools 查看所有網路請求，也看不到這個 Key。

### 案例四：效能對比數據

讓我們用實際數字說話。以下是某個真實專案從 Pages Router 遷移到 App Router (RSC) 的效能數據：

**測試環境：**
- 頁面：商品列表頁（20 個商品卡片）
- 網路：Fast 3G (750ms RTT)
- 裝置：Moto G4 (低階手機)

**傳統 SSR（Pages Router）：**

```
首次內容繪製（FCP）: 1.8s
最大內容繪製（LCP）: 3.2s
可互動時間（TTI）: 5.1s
JavaScript Bundle: 387KB (gzip 後)
```

**RSC（App Router）：**

```
首次內容繪製（FCP）: 1.2s (-33%)
最大內容繪製（LCP）: 2.1s (-34%)
可互動時間（TTI）: 2.8s (-45%)
JavaScript Bundle: 142KB (gzip 後) (-63%)
```

為什麼有這麼大的差異？

1. **Bundle 縮減**：商品卡片的渲染邏輯（日期格式化、價格計算）改用 Server Component，不進 Bundle
2. **串流渲染**：使用 Suspense，商品資料邊載入邊顯示，不用等全部資料回來
3. **選擇性 Hydration**：只有「加入購物車」按鈕是 Client Component，其他都不需要 Hydration

## 常見誤區與陷阱：避開地雷

### 誤區一：「`use client` 代表在客戶端渲染」

**錯誤理解：**加了 `'use client'` 的元件只在瀏覽器執行，不會經過 SSR。

**正確理解：**`'use client'` 只是標記「這個元件需要進入 Bundle」，它仍然會在伺服器先渲染一次（SSR），然後在瀏覽器 Hydrate。

```typescript
// app/Counter.tsx
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  console.log('Counter 渲染了', typeof window); // 伺服器和客戶端都會執行！

  return (
    <div>
      <p>計數: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

第一次載入頁面時，你會在伺服器日誌看到：`Counter 渲染了 undefined`（因為伺服器沒有 `window` 物件），然後在瀏覽器 Console 看到：`Counter 渲染了 object`。

**實務建議：**如果需要存取 `window`、`document` 等瀏覽器 API，放在 `useEffect` 裡：

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function WindowSize() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // 這裡安全，只在瀏覽器執行
    setWidth(window.innerWidth);

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <p>視窗寬度: {width}px</p>;
}
```

### 誤區二：「可以把任何東西當作 Prop 傳給 Client Component」

**錯誤做法：**

```typescript
// app/page.tsx (Server Component)
import ClientComponent from './ClientComponent';

export default async function Page() {
  const data = await fetchData();

  const processedData = {
    items: data.items,
    formatDate: (date: Date) => date.toLocaleDateString(), // 函數不能序列化！
    createdAt: new Date(), // Date 物件會被轉成字串
  };

  return <ClientComponent data={processedData} />;
}
```

當你嘗試這樣做時，會遇到錯誤：

```
Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
```

**原因：**Server Component 傳給 Client Component 的 props 必須能夠「序列化」（轉成 JSON），因為它們會透過網路傳輸（RSC Payload）。

**允許的類型：**

- 基本類型：string, number, boolean, null, undefined
- 純資料物件：`{ key: value }`
- 陣列：`[item1, item2]`
- Date（會自動轉成 ISO 字串）
- React 元素（`<Component />`）

**不允許的類型：**

- 函數（除非標記 `'use server'`）
- Class 實例（除非有自訂 `toJSON` 方法）
- Symbol
- Map / Set

**正確做法：**

```typescript
// app/page.tsx (Server Component)
import ClientComponent from './ClientComponent';

export default async function Page() {
  const data = await fetchData();

  const processedData = {
    items: data.items,
    createdAtISO: new Date().toISOString(), // 傳字串而非 Date 物件
  };

  return <ClientComponent data={processedData} />;
}

// app/ClientComponent.tsx (Client Component)
'use client';

export default function ClientComponent({ data }) {
  // 在客戶端處理日期格式化
  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString();

  return <p>{formatDate(data.createdAtISO)}</p>;
}
```

### 誤區三：「Server Component 不能使用狀態」

這不是誤區，而是設計如此。但很多人會問：「沒有 `useState`，怎麼處理表單？」

**答案：**用 Server Actions。

```typescript
// app/NewPostForm.tsx (Server Component)
import { db } from '@/lib/database';
import { revalidatePath } from 'next/cache';

async function createPost(formData: FormData) {
  'use server'; // 標記為 Server Action

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await db.post.create({
    data: { title, content }
  });

  revalidatePath('/posts'); // 重新驗證快取
}

export default function NewPostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">發布</button>
    </form>
  );
}
```

這個表單完全不需要 JavaScript！即使使用者停用 JS，表單仍然能運作（利用瀏覽器原生的 `<form>` 提交）。如果需要更好的使用者體驗，可以用 `useFormStatus` 顯示 Loading 狀態：

```typescript
// app/NewPostForm.tsx
import { createPost } from './actions';
import SubmitButton from './SubmitButton';

export default function NewPostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <SubmitButton />
    </form>
  );
}

// app/SubmitButton.tsx (Client Component)
'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? '發布中...' : '發布'}
    </button>
  );
}
```

### 誤區四：「RSC 只適合靜態內容」

有人認為 RSC 只適合部落格、文件網站這類「讀多寫少」的場景，但實際上它對動態應用也很有用。

**案例：即時通訊應用**

```typescript
// app/chat/[roomId]/page.tsx (Server Component)
import { db } from '@/lib/database';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default async function ChatRoom({ params }: { params: { roomId: string } }) {
  // 在伺服器獲取初始訊息
  const initialMessages = await db.message.findMany({
    where: { roomId: params.roomId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <MessageList initialMessages={initialMessages} roomId={params.roomId} />
      <MessageInput roomId={params.roomId} />
    </div>
  );
}

// app/chat/[roomId]/MessageList.tsx (Client Component)
'use client';

import { useState, useEffect } from 'react';

export default function MessageList({ initialMessages, roomId }) {
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    // 建立 WebSocket 連線接收即時訊息
    const ws = new WebSocket(`wss://example.com/chat/${roomId}`);

    ws.onmessage = (event) => {
      const newMessage = JSON.parse(event.data);
      setMessages(prev => [newMessage, ...prev]);
    };

    return () => ws.close();
  }, [roomId]);

  return (
    <ul>
      {messages.map(msg => (
        <li key={msg.id}>{msg.text}</li>
      ))}
    </ul>
  );
}
```

這個設計的優勢：

- 初始訊息由 Server Component 直接從資料庫抓取（快速、無 API 延遲）
- Client Component 只負責即時更新（WebSocket 連線）
- 首次載入時使用者立刻看到內容，不需要等待 WebSocket 連線

## 開發體驗的轉變：重新學習 React

### Mental Model 的切換

使用 RSC 需要轉變思維方式。傳統 React 的 Mental Model 是：

1. 元件是「資料的轉換器」：`data => UI`
2. 所有元件都在瀏覽器執行
3. 透過 `useEffect` 抓取資料

RSC 的 Mental Model 是：

1. 元件分為「伺服器端」和「客戶端」兩個執行環境
2. 預設在伺服器執行，需要互動時才標記 `'use client'`
3. 資料抓取直接在元件內 `await`

這個轉變需要時間適應。我的建議是：

**原則一：預設使用 Server Component，只在需要時才用 Client Component。**

需要 Client Component 的場景：

- 使用 React Hooks（`useState`, `useEffect`, etc.）
- 使用瀏覽器 API（`window`, `localStorage`, etc.）
- 需要事件監聽器（`onClick`, `onChange`, etc.）
- 使用第三方函式庫且該函式庫依賴瀏覽器環境

**原則二：盡可能把 Client Component 「推到葉子節點」。**

不好的設計：

```typescript
// app/page.tsx (Server Component)
import Dashboard from './Dashboard';

export default async function Page() {
  const data = await fetchData();
  return <Dashboard data={data} />;
}

// app/Dashboard.tsx (Client Component)
'use client';

export default function Dashboard({ data }) {
  const [filter, setFilter] = useState('all');

  return (
    <div>
      <FilterButtons filter={filter} setFilter={setFilter} />
      <StatCards data={data} />
      <DataTable data={data} filter={filter} />
    </div>
  );
}
```

這個設計的問題：整個 `Dashboard` 及其所有子元件都會進入 Bundle，即使 `StatCards` 和 `DataTable` 不需要任何客戶端邏輯。

更好的設計：

```typescript
// app/page.tsx (Server Component)
import StatCards from './StatCards'; // Server Component
import DataTable from './DataTable'; // Client Component（因為有過濾功能）

export default async function Page() {
  const data = await fetchData();

  return (
    <div>
      <StatCards data={data} /> {/* 不進 Bundle */}
      <DataTable data={data} /> {/* 進 Bundle，可互動 */}
    </div>
  );
}

// app/DataTable.tsx (Client Component)
'use client';

import FilterButtons from './FilterButtons';

export default function DataTable({ data }) {
  const [filter, setFilter] = useState('all');
  const filteredData = data.filter(item =>
    filter === 'all' || item.category === filter
  );

  return (
    <div>
      <FilterButtons filter={filter} setFilter={setFilter} />
      <table>
        {filteredData.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

### 開發流程的變化

**除錯體驗：**Server Component 的錯誤會顯示在終端機（Node.js 環境），而不是瀏覽器 Console。你需要同時關注兩個地方。

**測試策略：**Server Components 可以用 Node.js 測試框架（如 Vitest）測試，不需要 jsdom 或 Puppeteer 模擬瀏覽器環境。

```typescript
// __tests__/UserProfile.test.ts
import { render } from '@testing-library/react';
import UserProfile from '@/app/UserProfile';

// Mock 資料庫
jest.mock('@/lib/database', () => ({
  db: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: '1',
        name: 'Test User',
        bio: 'Test bio',
      }),
    },
  },
}));

test('renders user profile', async () => {
  const { container } = await render(<UserProfile userId="1" />);
  expect(container.textContent).toContain('Test User');
});
```

### 工具鏈的配合

**TypeScript：**Next.js 13+ 的 App Router 對 async Server Components 的類型支援仍在改進中。有時候你需要手動標註：

```typescript
// 這樣可能會報錯：'Promise<Element>' is not a valid JSX element
export default async function Page() {
  const data = await fetchData();
  return <div>{data.title}</div>;
}

// 解決方法：明確標註返回類型
export default async function Page(): Promise<JSX.Element> {
  const data = await fetchData();
  return <div>{data.title}</div>;
}
```

**ESLint：**需要安裝 `eslint-plugin-react-server` 來檢查 Server/Client Components 的使用規範。

**開發伺服器：**Next.js 的 Fast Refresh 對 RSC 的支援還不完美。有時候改動 Server Component 需要手動重新整理頁面。

## 總結與展望：RSC 的定位與未來

### RSC 解決了什麼問題？

React Server Components 不是銀彈，但它精準地解決了現代 Web 應用的核心痛點：

1. **Bundle 大小失控**：隨著應用複雜度增長，JavaScript Bundle 越來越大。RSC 讓我們可以把「不需要互動」的程式碼留在伺服器，徹底減少 Bundle。

2. **資料抓取的複雜性**：不再需要在 `getServerSideProps`、API Routes、`useEffect` 之間來回跳轉。元件需要什麼資料，就直接抓取。

3. **效能與 DX 的取捨**：傳統上，優化效能意味著犧牲開發體驗（手動程式碼分割、複雜的快取策略）。RSC 讓「寫簡單的程式碼」和「獲得好效能」不再衝突。

### RSC 不是什麼？

- **不是 SSR 的替代品**：它們是互補的。RSC 仍然需要 SSR 來生成初始 HTML。
- **不是萬能解決方案**：高度互動的應用（如線上編輯器、遊戲）仍然需要大量 Client Components。
- **不是強制要求**：Next.js 13+ 支援 RSC，但你仍然可以選擇 Pages Router（傳統 SSR）。

### 未來發展方向

React 團隊和社群正在探索更多可能性：

**1. Asset Loading 優化**：自動 preload Server Component 需要的資源（字體、圖片、CSS）。

**2. 更好的 Streaming 支援**：目前 Suspense 的串流渲染還有限制（如無法串流 `<head>` 標籤），未來會改進。

**3. 跨框架支援**：目前只有 Next.js 完整支援 RSC，但 Remix、Gatsby 等框架也在實驗中。

**4. Server Actions 的成熟**：Server Actions 仍是實驗性功能，未來會成為處理表單和 mutations 的標準方式。

### 我該現在採用 RSC 嗎？

如果你正在開始新專案，我強烈建議使用 Next.js 14+ 的 App Router（內建 RSC）。它已經足夠穩定，而且 Vercel 和社群的支援很完善。

如果你有既有專案，可以漸進式遷移：

1. 新功能用 App Router（RSC）
2. 既有頁面保持 Pages Router（傳統 SSR）
3. Next.js 允許兩者共存

**不建議立刻全部重寫**。RSC 的學習曲線不陡峭，但需要時間調整思維模式。先在低風險的頁面試水，累積經驗後再擴大範圍。

---

React Server Components 代表了 Web 開發範式的一次重大進化。它不是推翻過去，而是站在 SSR、CSR、SSG 這些技術的肩膀上，找到了一個更優雅的平衡點。

就像餐廳終於想通了「在廚房做菜，而不是讓客人在桌上煮」這個道理一樣，RSC 讓我們重新思考：什麼該在伺服器做，什麼該在瀏覽器做。這個問題的答案，將定義未來十年的 Web 開發方式。

現在，輪到你去探索這個新世界了。
