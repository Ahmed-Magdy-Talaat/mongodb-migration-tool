import fs from "fs";
import path from "path"

const parseProperties=()=>{
    let properties={};
    
    // getting the mongo-mograte.txt file 
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = path.dirname(__filename);
    const filePath = path.resolve(__dirname, '../mongo-migrate.txt');

    // reading the file 
    const data=fs.readFileSync(filePath,"utf-8");
    const lines=data.split('\n');
    
    //looping to get all the arguments in the file
    for(const line of lines){
        //check if the line is empty to continue looping without giving errors
        if(line.trim()==="")
            continue;
        //splitting the key and value 
        const index = line.indexOf('=');
        if (index !== -1) {
            // Split at the first "="
            const key = line.substring(0, index).trim();
            const value = line.substring(index + 1).trim();
            properties[key] = value;
        }
        else{
            //throwing error if the format is not correct
            throw new Error(`invalid error in the properties file in line ${line }`)
        }

    }

    const expectedPropertiesKeys=['configFile',"dbUrl","dbName"];
    const missingProperties= expectedPropertiesKeys.filter((prop)=> !(prop in properties));
    if(missingProperties.length>0){
        throw new Error(`Missing required properties: ${missingProperties.join(', ')}`);
    }
    return properties;

}

export default parseProperties;