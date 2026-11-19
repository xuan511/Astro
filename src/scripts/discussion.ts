type CommentItem = { id: number; author: string; created: string; body: string };
type Likes = { liked: boolean; likes: number };
type Page = Likes & { username: string | null; comments: CommentItem[]; before: number | null };

class BlogDiscussion extends HTMLElement {
  private lifetime?: AbortController;

  connectedCallback() {
    this.lifetime = new AbortController();
    // On first parse the custom element's children may still be loading.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mount(), {
        once: true,
        signal: this.lifetime.signal,
      });
    } else {
      this.mount();
    }
  }

  disconnectedCallback() {
    this.lifetime?.abort();
  }

  private mount() {
    const signal = this.lifetime!.signal;
    const element = <T extends HTMLElement>(selector: string) => this.querySelector<T>(selector)!;
    const api = this.dataset.api!;
    const article = this.dataset.article!.split('/').map(encodeURIComponent).join('/');
    const tokenKey = 'shijian:' + import.meta.env.BASE_URL + ':' + api + ':session';
    const readToken = () => {
      try {
        return sessionStorage.getItem(tokenKey) || '';
      } catch {
        return '';
      }
    };
    let token = readToken();
    const setToken = (value: string) => {
      token = value;
      try {
        if (value) sessionStorage.setItem(tokenKey, value);
        else sessionStorage.removeItem(tokenKey);
      } catch {
        /* Login still works in memory for this page. */
      }
    };
    const fieldset = element<HTMLFieldSetElement>('fieldset');
    const status = element('[data-status]');
    const retry = element('[data-retry]');
    const more = element('[data-more]');
    const actions = element('[data-actions]');
    const auth = element<HTMLDetailsElement>('[data-auth]');
    const logout = element('[data-logout]');
    const like = element<HTMLButtonElement>('[data-like]');
    const comments = element<HTMLOListElement>('[data-comments]');
    const login = element<HTMLFormElement>('[data-login]');
    const compose = element<HTMLFormElement>('[data-compose]');
    const password = element<HTMLInputElement>('[name=password]');
    const draft = element<HTMLTextAreaElement>('textarea');
    const submit = element<HTMLButtonElement>('[data-login] [type=submit]');
    const switchMode = element('[data-switch]');
    let before: number | null = null;
    let username: string | null = null;
    let register = false;
    let busy = false;

    function showAccount(name: string | null) {
      username = name;
      element('[data-account]').textContent = name || '';
      logout.hidden = compose.hidden = !name;
      auth.hidden = Boolean(name);
      if (name) auth.open = false;
    }

    async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
      const headers = new Headers();
      if (token) headers.set('Authorization', 'Bearer ' + token);
      if (body) headers.set('Content-Type', 'application/json');
      const response = await fetch(api + path, {
        method,
        headers,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status === 204) return undefined as T;
      if (response.status === 401) {
        setToken('');
        showAccount(null);
        throw new Error('登录已过期，请重新登录。');
      }
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const message = error?.detail || error?.body?.[0] || (Array.isArray(error) && error[0]);
        throw new Error(typeof message === 'string' ? message : '操作失败，请稍后重试。');
      }
      return response.json();
    }

    function row(item: CommentItem) {
      const li = document.createElement('li');
      const byline = document.createElement('small');
      byline.textContent = item.author + ' · ' + new Date(item.created).toLocaleString('zh-CN');
      const body = document.createElement('p');
      body.textContent = item.body;
      li.append(byline, body);
      return li;
    }

    function showLikes(state: Likes) {
      like.setAttribute('aria-pressed', String(state.liked));
      like.textContent = (state.liked ? '已赞' : '点赞') + ' · ' + state.likes;
    }

    async function load(append = false) {
      const url = 'discussion/' + article + '/' + (append && before ? '?before=' + before : '');
      let page: Page;
      const wasSignedIn = Boolean(token);
      try {
        page = await request<Page>(url);
      } catch (error) {
        if (!wasSignedIn || token) throw error;
        page = await request<Page>(url);
      }
      if (!append) comments.replaceChildren();
      comments.append(...page.comments.map(row));
      before = page.before;
      more.hidden = before === null;
      actions.hidden = false;
      showLikes(page);
      showAccount(page.username);
      status.textContent = comments.children.length ? '' : '还没有评论。';
    }

    async function run(task: () => Promise<void>) {
      if (busy) return;
      busy = fieldset.disabled = true;
      retry.hidden = true;
      status.textContent = '处理中…';
      try {
        await task();
      } catch (error) {
        if (signal.aborted) return;
        status.textContent =
          error instanceof TypeError ||
          (error instanceof DOMException && error.name === 'TimeoutError')
            ? '暂时无法连接讨论服务。'
            : error instanceof Error
              ? error.message
              : '请求失败。';
        retry.hidden = false;
      } finally {
        busy = fieldset.disabled = false;
      }
    }

    function setRegistrationMode(enabled: boolean) {
      register = enabled;
      submit.textContent = register ? '创建账号' : '登录';
      switchMode.textContent = register ? '已有账号，去登录' : '注册新账号';
      password.autocomplete = register ? 'new-password' : 'current-password';
      password.value = '';
    }
    switchMode.addEventListener('click', () => setRegistrationMode(!register), { signal });
    login.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void run(async () => {
          const result = await request<{ token: string; username: string }>(
            register ? 'register/' : 'login/',
            'POST',
            {
              username: element<HTMLInputElement>('[name=username]').value,
              password: password.value,
            },
          );
          setToken(result.token);
          showAccount(result.username);
          setRegistrationMode(false);
          await load();
        });
      },
      { signal },
    );
    logout.addEventListener(
      'click',
      () =>
        void run(async () => {
          await request('logout/', 'POST');
          setToken('');
          showAccount(null);
          await load();
        }),
      { signal },
    );
    like.addEventListener(
      'click',
      () => {
        if (!username) {
          auth.open = true;
          element<HTMLInputElement>('[name=username]').focus();
          return;
        }
        void run(async () => {
          const method = like.getAttribute('aria-pressed') === 'true' ? 'DELETE' : 'PUT';
          showLikes(await request<Likes>('articles/' + article + '/like/', method));
          status.textContent = method === 'PUT' ? '已点赞。' : '已取消点赞。';
        });
      },
      { signal },
    );
    compose.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void run(async () => {
          const saved = await request<CommentItem>('articles/' + article + '/comments/', 'POST', {
            body: draft.value,
          });
          comments.prepend(row(saved));
          draft.value = '';
          status.textContent = '评论已发表。';
        });
      },
      { signal },
    );
    more.addEventListener('click', () => void run(() => load(true)), { signal });
    retry.addEventListener('click', () => void run(() => load()), { signal });
    void run(() => load());
  }
}

if (!customElements.get('blog-discussion'))
  customElements.define('blog-discussion', BlogDiscussion);
