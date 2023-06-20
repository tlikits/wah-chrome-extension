// Saves options to chrome.storage
const getBase64Image = () => {
    File.prototype.convertToBase64 = function(callback) {
        var reader = new FileReader();
        reader.onloadend = function (e) {
            callback(e.target.result, e.target.error);
        };
        reader.readAsDataURL(this);
    };
    var file = document.querySelector('#profile-img').files[0]
    if (!file) {
        return ''
    }
    return new Promise((resolve, reject) => {
        try {
            file.convertToBase64(base64 => resolve(base64))
        } catch (error) {
            console.log('error', error)
            resolve('')
        }
    })
}

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

function fillBase64Image(base64) {
    const myFile = dataURLtoFile(base64, '200x265.jpg')
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(myFile);

    const fileInput = document.querySelector('#profile-img')
    fileInput.files = dataTransfer.files;
}

const clearOptions = async() => {
    await chrome.storage.sync.clear()
    document.querySelector('#img').src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
    document.getElementById('profile-img').value = '';
    document.getElementById('id').value = '';
    document.getElementById('prefix-th').value = '';
    document.getElementById('name-th').value = '';
    document.getElementById('lastname-th').value = '';
    document.getElementById('prefix-en').value = '';
    document.getElementById('name-en').value = '';
    document.getElementById('lastname-en').value = '';
    document.getElementById('email').value = '';
    document.getElementById('address').value = '';
    document.getElementById('autosubmit').checked = false;
}

const saveOptions = async () => {
    const base64Image = await getBase64Image()
    const id = document.getElementById('id').value;
    const prefixTh = document.getElementById('prefix-th').value;
    const nameTh = document.getElementById('name-th').value;
    const lastnameTh = document.getElementById('lastname-th').value;
    const prefixEn = document.getElementById('prefix-en').value;
    const nameEn = document.getElementById('name-en').value;
    const lastnameEn = document.getElementById('lastname-en').value;
    const email = document.getElementById('email').value;
    const address = document.getElementById('address').value;
    const enableAutoSubmit = document.getElementById('autosubmit').checked;

    if (!base64Image || !id || !prefixTh || !nameTh || !lastnameTh || !prefixEn || !nameEn || !lastnameEn || !email || !address) {
        const status = document.getElementById('status');
        status.textContent = 'Cannot save due to invalid input.';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
        return
    }

    chrome.storage.largeSync.set({ base64Image })
    chrome.storage.sync.set(
        { id, prefixTh, nameTh, lastnameTh, prefixEn, nameEn, lastnameEn, email, address, enableAutoSubmit },
        () => {
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 750);
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    document.querySelector('#profile-img').onchange = async function() {
        const base64Image = await getBase64Image()
        fillBase64Image(base64Image)
        document.querySelector('#img').src = base64Image
    }
    chrome.storage.largeSync.get(['base64Image'], (items) => {
        if (!items.base64Image) {
            return
        }
        fillBase64Image(items.base64Image)
        document.querySelector('#img').src = items.base64Image
    })
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
            enableAutoSubmit: false,
        },
        (items) => {
            document.getElementById('id').value = items.id;
            document.getElementById('prefix-th').value = items.prefixTh;
            document.getElementById('name-th').value = items.nameTh;
            document.getElementById('lastname-th').value = items.lastnameTh;
            document.getElementById('prefix-en').value = items.prefixEn;
            document.getElementById('name-en').value = items.nameEn;
            document.getElementById('lastname-en').value = items.lastnameEn;
            document.getElementById('email').value = items.email;
            document.getElementById('address').value = items.address;
            document.getElementById('autosubmit').checked = items.enableAutoSubmit;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('clear').addEventListener('click', clearOptions);
