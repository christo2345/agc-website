import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width':1568,'height':736})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('file:///home/claude/cpsign/h/harness.html'); await pg.wait_for_timeout(7000)
        f = pg.frame_locator('#f')
        fr = pg.frames[1]
        fr.on if False else None
        async def st(tag):
            t = await fr.evaluate("()=>[document.getElementById('agc-lock-title').textContent, document.getElementById('agc-lock-pw-label').textContent, document.getElementById('agc-lock-msg').textContent, document.getElementById('agc-lock-hint').textContent, document.getElementById('agc-lock').hidden, document.documentElement.classList.contains('agc-locked')].join(' | ')")
            print(tag, '::', t)
        await st('start')
        await pg.screenshot(path='/home/claude/cpsign/h/1-temp.png')
        await fr.evaluate("()=>document.getElementById('agc-lock-forgot').click()"); await pg.wait_for_timeout(800); await st('email-me')
        await fr.evaluate("()=>document.getElementById('agc-lock-forgot').click()"); await pg.wait_for_timeout(800); await st('email-me again')
        await fr.evaluate("()=>{document.getElementById('agc-lock-pw').value='WRONG1';document.getElementById('agc-lock-go').click()}"); await pg.wait_for_timeout(800); await st('wrong temp')
        await fr.evaluate("()=>{document.getElementById('agc-lock-pw').value='temp42';document.getElementById('agc-lock-go').click()}"); await pg.wait_for_timeout(800); await st('right temp')
        await pg.screenshot(path='/home/claude/cpsign/h/2-create.png')
        await fr.evaluate("()=>{document.getElementById('agc-lock-pw').value='abcdefgh1';document.getElementById('agc-lock-pw2').value='abcdefgh2';document.getElementById('agc-lock-go').click()}"); await pg.wait_for_timeout(500); await st('mismatch')
        await fr.evaluate("()=>{document.getElementById('agc-lock-pw').value='abcdefgh1';document.getElementById('agc-lock-pw2').value='abcdefgh1';document.getElementById('agc-lock-go').click()}"); await pg.wait_for_timeout(2500); await st('created')
        print('LOG', await pg.evaluate("()=>LOG.join(', ')"))
        print('errors', errs or 'none')
        await b.close()
asyncio.run(main())
