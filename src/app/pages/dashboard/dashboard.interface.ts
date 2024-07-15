export interface Bill {
    name: string;
    price: number;
    saved?: boolean;
}

export interface CurrentBillConfig {
    income: number;
    bills: Bill[];
}