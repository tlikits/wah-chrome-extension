import './chrome-Storage-largeSync.min.js'

const WAH_REGISTER_URL = 'http://161.82.213.251/opp/app/register.php'

class WahExtension {
    constructor() {
        this.onIconClicked = this.onIconClicked.bind(this)
    }

    async onIconClicked(currentTab) {
        try {
            const profile = await this.loadProfile()
            const autoFill = new WahRegisterAutoFill(profile)
            await autoFill.execute()
        } catch (error) {
            console.warn(`Error on autofilling | error=${error.name}, message=${error.message}`)
        }
    }

    async loadProfile() {
        try {
            const [personalInfo, imageBase64] = await Promise.all([
                this.getProfile(),
                this.getImage()
            ])
            const profile = {
                ...personalInfo,
                imageBase64,
            }
            return profile
        } catch(error) {
            chrome.runtime.openOptionsPage()
            throw error
        }
    }

    async getProfile() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(
                {
                    id: '',
                    prefixTh: '',
                    nameTh: '',
                    lastnameTh: '',
                    prefixEn: '',
                    nameEn: '',
                    lastnameEn: '',
                    email: '',
                    address: '',
                },
                (items) => {

                    const {
                        id,
                        prefixTh,
                        nameTh,
                        lastnameTh,
                        prefixEn,
                        nameEn,
                        lastnameEn,
                        email,
                        address,
                    } = items
                    if (!id || !prefixTh || !nameTh || !lastnameTh || !prefixEn || !nameEn || !lastnameEn || !email || !address) {
                        return reject('Missing personal information')
                    }
                    resolve(items)
                }
            );
        })
    }

    async getImage() {
        return new Promise((resolve, reject) => {
            chrome.storage.largeSync.get(['base64Image'], (items) => {
                if (items.base64Image) {
                    resolve(items.base64Image)
                } else {
                    reject('No image')
                }
            })
        })
    }
}

class WahRegisterAutoFill {
    constructor(profile) {
        this.profile = profile
    }

    async execute() {
        await this.openTab()
            .then(() => this.ensureForm())
            .then(() => this.fillForm())


        const isAutoSubmit = await this.isAutoSubmit()
        if (!isAutoSubmit) {
            return
        }
        return this.submitForm()
            .then(() => console.log('Execution completed...'))
            .then(() => this.notify())
    }

    async isAutoSubmit() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get({ enableAutoSubmit: false }, (item) => {
                    resolve(item.enableAutoSubmit)
                })
            } catch (error) {
                resolve(false)
            }
        })
    }

    async openTab() {
        console.log('Opening tab...')
        if (this.tab) {
            return
        }
        this.tab = await chrome.tabs.create({
            url: WAH_REGISTER_URL,
        })
        this.tabId = this.tab.id
    }

    async ensureForm() {
        console.log('Ensuring form...')
        while (true) {
            if (await this.isFormAvailable()) {
                break
            }
            await sleep()
            chrome.tabs.reload(this.tabId)
        }
    }

    async fillForm() {
        console.log('Filling form...')
        const executedResult = await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            func: fillForm,
            args: [this.profile]
        })
        const { result } = executedResult[0]
        if (result.success) {
            return
        }
        throw new Error(result.reason)
    }

    async submitForm() {
        console.log('Submitting form...')
        const executedResult = await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            func: submitForm,
        })
        const { result } = executedResult[0]
        if (!result.success) {
            throw new Error(result.reason)
        }
        return this.reloadIfFail()
    }

    async notify() {
        chrome.notifications.create('', {
            title: 'Submit form completed',
            message: 'Submit form completed. Please check the result',
            iconUrl: '../icon.png',
            type: 'basic',
        })
    }

    async reloadIfFail() {
        return new Promise((resolve, reject) => {
            const errorHandler = (detail) => {
                if (this.isCurrentTabCallbackDetail(detail)) {
                    console.log(`Error occur on tab #${this.tabId} - ${detail.error}`)
                    chrome.tabs.reload(this.tabId)
                    console.log('Reloading...')
                }
            }
            chrome.webNavigation.onErrorOccurred.addListener(errorHandler)
            const completeHandler = (detail) => {
                console.log(detail)
                if (this.isCurrentTabCallbackDetail(detail)) {
                    chrome.webNavigation.onErrorOccurred.removeListener(errorHandler)
                    chrome.webNavigation.onCompleted.removeListener(completeHandler)
                    console.log('complete')
                    resolve()
                }
            }
            chrome.webNavigation.onCompleted.addListener(completeHandler)
            const closeTabHandler = ((tabId, removed) => {
                if (this.isCurrentTab(tabId)) {
                    chrome.webNavigation.onCompleted.removeListener(completeHandler)
                    chrome.webNavigation.onErrorOccurred.removeListener(errorHandler)
                    chrome.tabs.onRemoved.removeListener(closeTabHandler)
                    console.log('Handle closing tab...')
                    reject(new Error('Tab closed'))
                }
            })
            chrome.tabs.onRemoved.addListener(closeTabHandler)
        })
    }

    async isCurrentTab(id) {
        return id === this.tabId
    }

    async isCurrentTabCallbackDetail(detail) {
        return this.isCurrentTab(detail.tabId)
    }

    async isFormAvailable() {
        const executedResult = await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            func: isFormAvailable,
        })
        const { result } = executedResult[0]
        return result.isAvailable
    }

    async onCloseTab() {

    }
}

function fillForm(profile) {
    try {
        //  setup fn
        function dataURLtoFile(dataurl, filename) {
            var arr = dataurl.split(','),
                mime = arr[0].match(/:(.*?);/)[1],
                bstr = atob(arr[arr.length - 1]),
                n = bstr.length,
                u8arr = new Uint8Array(n);
            while(n--){
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, {type:mime});
        }

        function fillByName(name, value) {
            document.querySelector(`[name="${name}`).value = value
        }

        function fill({
            imageBase64,
            id,
            prefixTh,
            nameTh,
            lastnameTh,
            prefixEn,
            nameEn,
            lastnameEn,
            email,
            address,
        }) {
            fillBase64Image(imageBase64)
            fillByName('CARD_ID', id)
            fillByName('PREFIX_TH', prefixTh)
            fillByName('NAME_TH', nameTh)
            fillByName('LASTNAME_TH', lastnameTh)
            fillByName('PREFIX_EN', prefixEn)
            fillByName('NAME_EN', nameEn)
            fillByName('LASTNAME_EN', lastnameEn)
            fillByName('EMAIL', email)
            fillByName('ADDRESS', address)

            fillCaptcha()
            checkConfirm()
        }

        function fillBase64Image(base64) {
            const myFile = dataURLtoFile(base64, '200x265.jpg')
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(myFile);

            const fileInput = document.getElementsByName('fileUpload')[0]
            fileInput.files = dataTransfer.files;
            if (fileInput.files && fileInput.files[0]) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    const blah = document.querySelector('#blah')
                    blah.src = e.target.result
                    blah.width = 200
                    blah.height = 265
                };
                reader.readAsDataURL(fileInput.files[0]);
            }
        }

        function fillCaptcha() {
            const captcha = document.getElementById('grad1').innerHTML.trim()
            document.getElementsByName('capt')[0].value = captcha
        }

        function checkConfirm() {
            var isChecked = document.getElementsByName('ckAccept')[0].checked
            if (!isChecked) {
                document.getElementsByName('ckAccept')[0].click()
            }
        }

        fill(profile)
        return { success: true }
    } catch (error) {
        return {
            success: false,
            reason: `${error.name} - ${error.message}`
        }
    }

}

function submitForm() {
    try {
        document.getElementsByName('btLogin')[0].click()
        return { success: true }
    } catch (error) {
        return {
            success: false,
            reason: `${error.name} - ${error.message}`
        }
    }
}

function isFormAvailable() {
    try {
        const element = document.getElementsByName('btLogin')[0]
        return { isAvailable: !!element }
    } catch (error) {
        return { isAvailable: false }
    }
}

function isFormReady() {
    const formReady = document.querySelector('[name="btLogin"]')
    return !!formReady
}

function sleep(timeout) {
    if (timeout === undefined) {
        timeout = 2_000 + Math.random() * 1_000 // ~ 1-2 seconds
    }
    return new Promise((res) => {
        setTimeout(() => res(), timeout)
    })
}

function run() {
    const extension = new WahExtension()
    chrome.action.onClicked.addListener(extension.onIconClicked)
}

run()
