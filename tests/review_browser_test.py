"""Midterm end-to-end regression; requires Playwright and installed Chromium."""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('SITE_URL','http://127.0.0.1:8000/index.html')

def run():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True)
        ctx=browser.new_context(viewport={'width':1440,'height':1080})
        page=ctx.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.goto(URL)
        expect(page.locator('html')).to_have_attribute('data-app-ready','true')
        bank={q['id']:q for q in page.evaluate('MidtermBank')}
        review=page.locator('#review-dialog')
        def current():return review.locator('[data-review-question]').get_attribute('data-review-question')
        def answer(correct=True):
            q=bank[current()]
            if q['type']=='choice':
                value=q['answer'] if correct else (q['answer']+1)%len(q['choices'])
                review.locator(f'input[name="review-answer"][value="{value}"]').check()
            else:review.locator('#review-number').fill(str(q['answer'] if correct else q['answer']+1000))
            review.locator('#review-answer button[type=submit]').click()
            expect(review.locator('.review-explanation')).to_have_class('review-explanation '+('correct' if correct else 'incorrect'))
        page.locator('#review-button').click()
        expect(review.locator('.review-section-row')).to_have_count(18)
        review.locator('[data-section="3.3"]').click()
        review.locator('#review-answer button[type=submit]').click()
        expect(review.locator('#review-input-message')).to_contain_text('请输入')
        review.locator('#review-number').fill('1/0')
        review.locator('#review-answer button[type=submit]').click()
        assert page.evaluate('MidtermReview.stats().attempted')==0
        review.locator('[data-review-action=hint]').click()
        assert page.evaluate('MidtermReview.stats().attempted')==0
        wrong_id=current();answer(False)
        expect(review.locator('#review-wrong-count')).to_have_text('1')
        saved=page.evaluate('MidtermReview.exportRecords()')
        review.locator('#review-answer').evaluate('(e)=>e.requestSubmit()')
        assert page.evaluate('MidtermReview.exportRecords()')==saved
        page.reload();page.locator('#review-button').click()
        review.locator('[data-review-view=mistakes]').click()
        review.locator('[data-id="'+wrong_id+'"]').click();answer()
        expect(review.locator('#review-wrong-count')).to_have_text('0')
        assert page.evaluate('MidtermReview.exportRecords()')[wrong_id]['attempts']==2
        print('PASS: 空值/非法数值/提示不记分，首次提交锁定，错题刷新恢复与重练移除',flush=True)

        seen=set()
        for section in page.evaluate('Curriculum.sections.map(s=>s.number)'):
            review.locator('[data-review-view=home]').click()
            review.locator('[data-section="'+section+'"]').click()
            count=sum(q['section']==section for q in bank.values())
            for _ in range(count):
                seen.add(current());answer()
                expect(review.locator('.review-explanation ol li')).not_to_have_count(0)
                review.locator('[data-review-action=next]').click()
            expect(review.locator('.review-finish')).to_contain_text(f'{count} / {count}')
        assert len(seen)==90
        st=page.evaluate('MidtermReview.stats()')
        assert st['attempted']==90 and st['latestCorrect']==90 and st['mistakes']==0
        print('PASS: 18 节全部 90 道题可作答，解析和成绩正确，实验题与备考题记录互通',flush=True)

        review.locator('[data-review-view=home]').click()
        review.locator('[data-review-action=mixed]').click()
        chapters=[]
        for i in range(12):
            chapters.append(bank[current()]['section'][0]);answer(i!=0)
            review.locator('[data-review-action=next]').click()
        assert all(chapters.count(c)==4 for c in '123')
        expect(review.locator('.review-finish')).to_contain_text('11 / 12')
        review.locator('[data-review-view=home]').click()
        review.locator('#review-chapter').select_option('3')
        expect(review.locator('.review-section-row')).to_have_count(6)
        review.locator('[data-review-action=mixed]').click()
        assert bank[current()]['section'].startswith('3.')
        active=current();review.locator('[data-review-action=home]').click()
        review.locator('[data-review-action=resume]').click();assert current()==active
        review.locator('[data-review-action=close]').click()
        page.locator('#syllabus-button').click()
        page.locator('.syllabus-section').filter(has=page.locator('[data-practice-section="3.4"]')).locator('summary').click()
        page.locator('[data-practice-section="3.4"]').click()
        assert bank[current()]['section']=='3.4'
        print('PASS: 混合小测每章四题，分章筛选，继续练习，清单跳转',flush=True)

        review.locator('[data-review-action=backup]').click()
        with page.expect_download() as download:page.locator('[data-progress-export]').click()
        exported=json.loads(Path(download.value.path()).read_text())
        assert exported['version']==2 and len(exported['review'])==90
        ctx2=browser.new_context(viewport={'width':1024,'height':768})
        other=ctx2.new_page();other.goto(URL);other.locator('#progress-button').click()
        def upload(data):other.locator('#progress-file').set_input_files({'name':'progress.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
        upload(exported);expect(other.locator('#transfer-status')).to_contain_text('已合并')
        assert other.evaluate('MidtermReview.exportRecords()')==exported['review']
        before=other.evaluate('MidtermReview.exportRecords()')
        corrupt=json.loads(json.dumps(exported));corrupt['review']['seq-1']['correct']=999999
        upload(corrupt);expect(other.locator('#transfer-status')).to_contain_text('无法导入')
        assert other.evaluate('MidtermReview.exportRecords()')==before
        upload({'format':'zhiwei-progress','version':1,'completed':['ser-1']})
        expect(other.locator('#transfer-status')).to_contain_text('旧版进度')
        assert other.evaluate('MidtermReview.exportRecords()')==before
        other.reload();assert other.evaluate('MidtermReview.exportRecords()')==before
        print('PASS: 新旧备份兼容、跨浏览器导入、错误文件不污染记录、刷新持久化',flush=True)

        page.locator('#dialog-done').click()
        for width,height in [(1440,1080),(1024,768),(820,1180),(768,1024),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.locator('#review-button').click()
            for view in ['home','mistakes','weak']:
                review.locator('[data-review-view='+view+']').click()
                assert review.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,view)
            review.locator('[data-review-view=home]').click()
            review.locator('#review-chapter').select_option('all')
            review.locator('[data-section="3.4"]').click();answer()
            assert review.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,'answer')
            review.evaluate('(e)=>e.scrollTop=0')
            page.screenshot(path=str(ROOT/'docs'/f'midterm-review-{width}.png'))
            review.locator('[data-review-action=close]').click()
            page.locator('[data-chapter=applied]').click()
            page.locator('[data-model=parametric]').click()
            page.locator('#a-slider').evaluate('(e)=>{e.value=0;e.dispatchEvent(new Event("input",{bubbles:true}));}')
            expect(page.locator('#observation')).to_contain_text('水平切线')
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
        print('PASS: 五种屏幕尺寸的总览、错题、薄弱点、答题解析、参数图均无横向溢出',flush=True)

        restricted=browser.new_context(viewport={'width':820,'height':1180},has_touch=True)
        restricted.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}})')
        tablet=restricted.new_page();tablet.goto(URL);restricted.set_offline(True)
        tablet.locator('#review-button').tap()
        tablet.locator('[data-section="3.3"]').tap()
        qid=tablet.locator('[data-review-question]').get_attribute('data-review-question')
        tablet.locator('#review-number').fill(str(bank[qid]['answer']))
        tablet.locator('#review-answer button[type=submit]').tap()
        expect(tablet.locator('.review-explanation')).to_have_class('review-explanation correct')
        expect(tablet.locator('#review-storage')).to_contain_text('未允许保存')
        print('PASS: 触屏操作、禁用存储和加载后断网仍可答题',flush=True)
        assert not errors,errors
        browser.close()
    print('Passed 6 midterm browser check groups.',flush=True)
if __name__=='__main__':run()
