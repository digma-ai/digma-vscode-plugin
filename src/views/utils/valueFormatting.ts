export class DecimalRounder 
{
    public getRoundedString(number: number): string{
        
        const asString = String(number);
        const firstDigit = asString[0];
        if (asString.length<=3){
            return asString;
        }
        else{
            const closestRoundedUp = Number(firstDigit) * Math.pow(10,asString.length-1);
            const closestRoundedDown = (Number(firstDigit)-1) * Math.pow(10,asString.length-1);
    
            let closestNumber = closestRoundedDown;
            if ((closestRoundedUp-number)<(number-closestRoundedDown)){
                closestNumber=closestRoundedUp;
            }
    
            return "~" +this.format(closestNumber,1);
        }


    }

    private format(num: number, digits:number): string {
        const lookup = [
          { value: 1, symbol: "" },
          { value: 1e3, symbol: "k" },
          { value: 1e6, symbol: "M" },
          { value: 1e9, symbol: "G" },
          { value: 1e12, symbol: "T" },
          { value: 1e15, symbol: "P" },
          { value: 1e18, symbol: "E" }
        ];
        const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
        const item = lookup.slice().reverse().find(function(item) {
          return num >= item.value;
        });
        return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
      }

}