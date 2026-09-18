import {NotFoundException} from "@nestjs/common";


export class MeterNotFoundException extends NotFoundException {
    constructor(meterId: string) {
        super();
    }
}