import { Injectable } from '@angular/core';

@Injectable({providedIn: 'root'})
export class CodeUtil {

    getSessionStorageItem(sessionToken: string) {
        let itemAsJSONObj = sessionStorage.getItem(sessionToken);

        if (itemAsJSONObj) {
            try {
                let parsed = JSON.parse(itemAsJSONObj);

                return parsed;
            }
            catch(err) {
                return itemAsJSONObj;
            }
        }

        return null;
    }

    isStringNullOrEmpty(str: string) {
        if (str === null || str === undefined || str === "") {
            return true;
        }

        return false;
    }

}